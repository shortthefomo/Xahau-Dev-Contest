const xrpl = require('xrpl')
const xahau = require('@transia/xrpl')
const fs = require('fs').promises

// This sample application writes and reads from a simple text file to serve user requests.
// Real-world applications may use a proper local database like sqlite.
const ledgersFile = 'ledgers_datafile.txt'
const transactionsFile = 'transactions_datafile.txt'
export class bridge {
    async issue(isReadOnly) {
        
    }

    async process(message, isReadOnly) {
        // This sample application defines two simple messages. 'get' and 'set'.
        // It's up to the application to decide the structure and contents of messages.
        console.log('process', message, isReadOnly)

        const client_xrpl = new xrpl.Client('wss://s.altnet.rippletest.net:51233')
        await client_xrpl.connect()
        const client_xahau = new xahau.Client('wss://xahau-test.net')
        await client_xahau.connect()


        // these wallets will be manadged via NPM and be distributed multisig, not part of this hackathon
        // but ive done this in the past with the oracle 
        // https://github.com/shortthefomo/mycontract/blob/71db56ec9d9fc76bde1c0aac188f00368a3c5904/src/mycontract.js#L150
        const xrpl_cold_wallet = xrpl.Wallet.fromSecret('saUw1KEhyY4WSBhFuFTK9h2Bw3e1R', { algorithm: 'ecdsa-secp256k1' })
        const xahau_cold_wallet = xahau.Wallet.fromSecret('saUw1KEhyY4WSBhFuFTK9h2Bw3e1R', { algorithm: 'ecdsa-secp256k1' })
        
        let response
        
        switch (message.cmd) {
            case 'process':
                console.log('processing....')
                // Retrieve the last ledger(s) from both networks.
                const txs = await this.processLastLedgers(client_xahau, client_xrpl)

                response = {
                    'status': 'success',
                    'type': 'response',
                    'result': {
                        'txs': txs,
                        'response': 'tesSUCCESS'
                    }
                }
                // console.log(txs)
                break                
            case 'get':
                // Returns a result based on hash.
                break
            default:
                response = {
                    type: 'error',
                    error: 'operation not supported'
                }
                break
        }

        // Finally close connections.
        await client_xahau.disconnect()
        await client_xrpl.disconnect()
        return response
    }

    async processLastLedgers(xahau_client, xrpl_client) {
        const data = {}
        const past_data = await this.getData()
        const txs = await Promise.all([this.fetchCurrentLedger(xahau_client, 'xahau'), this.fetchCurrentLedger(xrpl_client, 'xrpl')])
        for (let index = 0; index < txs.length; index++) {
            const tx = txs[index]
            data[tx.network] = {
                current: tx.current,
                past: past_data !== undefined ? past_data[tx.network].current : undefined
            }
            await this.processLedgers(data[tx.network], tx.network === 'xrpl' ?  xrpl_client:xahau_client , tx.network)
        }
        
        console.log('data', data)
        await this.setData(data)
        return data
    }

    async processLedgers(data, ledger, network) {
        let index = data.past
        const results = []
        let fetch = true
        // Now close the gap.
        while (fetch) {
            const res = await this.fetchLedger(index, ledger, network)
            if (data.past === undefined || index >= data.current) { fetch = false }
            // console.log(network, index, res)
            index++
            if (res === undefined) { continue }
            if ('error' in res.result) { continue }
            results.push(res)
        }
        return results
    }

    async fetchLedger(index, ledger, network) {
        const XRPL_DESTINATION_TAG = 1
        const XAHAU_DESTINATION_TAG = 21338
        let tdata = await this.getTransactions()
        if (tdata === undefined) {
            tdata = {}
            tdata[network] = []
        }
        else if (tdata[network] === undefined) {
            tdata[network] = []
        }

        const request = {
            'id': 'issuer-bridge-fetch-tx',
            'command': 'ledger',
            'ledger_index': index,
            'transactions': true,
            'expand': true,
            'owner_funds': true
        }
        const ledger_result = await ledger.request(request)
        let write_data = false
        const transactions = ledger_result.result?.ledger?.transactions
        //tx_json
        if (transactions === undefined) { return }
        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i] 

            if (network === 'xrpl') {
                if (transaction.tx_json.TransactionType !== 'Payment') { continue }
                if (transaction.meta?.TransactionResult !== 'tesSUCCESS') { continue }
                if (typeof transaction?.meta?.delivered_amount !== 'object') { continue }
                if (transaction?.meta?.delivered_amount?.currency !== 'BAR') { continue }
                if (transaction?.meta?.delivered_amount?.issuer !== 'rNgUJpDFNkeVJ6xNaMXVcZPy2XrPmuGBSn') { continue }
                if (transaction.tx_json.Destination !== 'rNgUJpDFNkeVJ6xNaMXVcZPy2XrPmuGBSn')  { continue }
            }

            if (network === 'xahau') {
                if (transaction.TransactionType !== 'Payment') { continue }
                if (transaction.metaData?.TransactionResult !== 'tesSUCCESS') { continue }
                if (typeof transaction?.metaData?.delivered_amount !== 'object') { continue }
                if (transaction?.metaData?.delivered_amount?.currency !== 'BAR') { continue }
                if (transaction?.metaData?.delivered_amount?.issuer !== 'rNgUJpDFNkeVJ6xNaMXVcZPy2XrPmuGBSn') { continue }
                if (transaction.Destination !== 'rNgUJpDFNkeVJ6xNaMXVcZPy2XrPmuGBSn')  { continue }
            }
            
            console.log('Found transaction', network)
            console.log(transaction)
            tdata[network].push(transaction)
            write_data = true
        }
        if (write_data) {
            console.log('writing transaction data...')
            this.saveTransactions(tdata)
        }
        return ledger_result
    }

    async fetchCurrentLedger(ledger, network) {
        const request = {
            'id': 'issuer-bridge-fetch',
            'command': 'ledger_current'
        }
        const ledger_result = await ledger.request(request)
        console.log('ledger_result', network, ledger_result.result)
        return { network, current: ledger_result.result.ledger_current_index }
    }

    async saveTransactions(data) {
        // HotPocket subjects data-on-disk to consensus.
        try {
            await fs.writeFile(transactionsFile, JSON.stringify(data))
        }
        catch {
            console.log('ERROR, could not write transactions data to disk.')
        }
    }

    async getTransactions() {
        try {
            return JSON.parse((await fs.readFile(transactionsFile)).toString())
        }
        catch {
            // console.log('Transactions Data file not created yet. Returning empty data.')
            return undefined
        }
    }

    async setData(data) {
        // HotPocket subjects data-on-disk to consensus.
        try {
            await fs.writeFile(ledgersFile, JSON.stringify(data))
        }
        catch {
            console.log('ERROR, could not write data to ledgers disk.')
        }
    }

    async getData() {
        try {
            return JSON.parse((await fs.readFile(ledgersFile)).toString())
        }
        catch {
            console.log('Ledgers data file not created yet. Returning empty data.')
            return undefined
        }
    }
}