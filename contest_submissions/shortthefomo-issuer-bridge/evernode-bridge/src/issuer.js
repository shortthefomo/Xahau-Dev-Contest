const xrpl = require('xrpl')
const xahau = require('@transia/xrpl')
const fs = require('fs').promises

// This sample application writes and reads from a simple text file to serve user requests.
// Real-world applications may use a proper local database like sqlite.
const transactionsFile = 'transactions_datafile.txt'

export class issuer {
    async issue(isReadOnly) {
        const NetworkID = 21338
        const XRPL_DESTINATION_TAG = 1
        const XAHAU_DESTINATION_TAG = 21338

        console.log('issue', isReadOnly)
        const tdata = await this.getTransactions()
        const sdata = { ...tdata }
        if (tdata === undefined) { return }
        console.log('tdata', tdata)

        const client_xrpl = new xrpl.Client('wss://s.altnet.rippletest.net:51233')
        await client_xrpl.connect()
        const client_xahau = new xahau.Client('wss://xahau-test.net')
        await client_xahau.connect()

        // these wallets will be manadged via NPM and be distributed multisig, not part of this hackathon
        // but ive done this in the past with the oracle 
        // https://github.com/shortthefomo/mycontract/blob/71db56ec9d9fc76bde1c0aac188f00368a3c5904/src/mycontract.js#L150
        const xrpl_cold_wallet = xrpl.Wallet.fromSecret('saUw1KEhyY4WSBhFuFTK9h2Bw3e1R', { algorithm: 'ecdsa-secp256k1' })
        const xahau_cold_wallet = xahau.Wallet.fromSecret('saUw1KEhyY4WSBhFuFTK9h2Bw3e1R', { algorithm: 'ecdsa-secp256k1' })
        

        if ('xahau' in tdata) {
            for (let index = 0; index < tdata['xahau'].length; index++) {
                const transaction = tdata['xahau'][index]
                // Check the destination has the trustline
                const request = {
                    'id': 'issuer-bridge-trustlines',
                    'command': 'account_lines',
                    'account': transaction.Account
                }
                const ledger_result = await client_xrpl.request(request)
                console.log('trustlines check', ledger_result)
                // Send the value or reverse the value
                if ('error' in ledger_result.result || transaction.DestinationTag !== XRPL_DESTINATION_TAG) {
                    console.log('Need to return these funds!')
                    const send_token_tx = {
                        'TransactionType': 'Payment',
                        'Account': xahau_cold_wallet.address,
                        'DeliverMax': transaction.Amount,
                        'Destination':  transaction.Account,
                        'SourceTag': XAHAU_DESTINATION_TAG,
                        'NetworkID': NetworkID
                    }

                    const pay_prepared = await client_xahau.autofill(send_token_tx)
                    const pay_signed = xahau_cold_wallet.sign(pay_prepared)
                    console.log(`Sending ${transaction.Amount.value} ${transaction.Amount.currency} to ${transaction.Account}... on XAHAU`)
                    const pay_result = await client_xahau.submitAndWait(pay_signed.tx_blob)
                    if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
                        console.log(`Transaction succeeded: https://xahau-testnet.xrpl.org/transactions/${pay_signed.hash}`)
                        sdata['xahau'].splice(index, 1)
                        this.saveTransactions(sdata)
                    } else {
                        console.log(pay_result)
                        throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`
                    }
                }
                else if ('error' in ledger_result.result) {
                    
                }
                else {
                    for (let index = 0; index < ledger_result.result.lines.length; index++) {
                        const line = ledger_result.result.lines[index]
                        if (line.account !== xrpl_cold_wallet.address) { continue }
                        // Forward the amount
                        const send_token_tx = {
                            'TransactionType': 'Payment',
                            'Account': xrpl_cold_wallet.address,
                            'DeliverMax': transaction.Amount,
                            'Destination':  transaction.Account,
                            'SourceTag': XAHAU_DESTINATION_TAG
                        }

                        const pay_prepared = await client_xrpl.autofill(send_token_tx)
                        const pay_signed = xrpl_cold_wallet.sign(pay_prepared)
                        console.log(`Sending ${transaction.Amount.value} ${transaction.Amount.currency} to ${transaction.Account}... on XRPL`)
                        const pay_result = await client_xrpl.submitAndWait(pay_signed.tx_blob)
                        if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
                            console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed.hash}`)
                            sdata['xahau'].splice(index, 1)
                            this.saveTransactions(sdata)
                        } else {
                            console.log(pay_result)
                            throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`
                        }
                    }
                }
            }
        }
        

        if ('xrpl' in tdata) {
            for (let index = 0; index < tdata['xrpl'].length; index++) {
                const transaction = tdata['xrpl'][index]
                // Check the destination has the trustline
                const request = {
                    'id': 'issuer-bridge-trustlines',
                    'command': 'account_lines',
                    'account': transaction.tx_json.Account
                }
                const ledger_result = await client_xahau.request(request)
                console.log('trustlines check', ledger_result)
                // Send the value or reverse the value
                if ('error' in ledger_result.result || transaction.tx_json.DestinationTag !== XAHAU_DESTINATION_TAG) {
                    console.log('Need to return these funds!')
                    const send_token_tx = {
                        'TransactionType': 'Payment',
                        'Account': xrpl_cold_wallet.address,
                        'Amount': transaction.meta.delivered_amount,
                        'Destination': transaction.tx_json.Account,
                        'SourceTag': XRPL_DESTINATION_TAG
                    }

                    const pay_prepared = await client_xrpl.autofill(send_token_tx)
                    const pay_signed = xrpl_cold_wallet.sign(pay_prepared)
                    console.log(`Sending ${ transaction.meta.delivered_amount.value} ${ transaction.meta.delivered_amount.currency} to ${transaction.tx_json.Account}... on XRPL`)
                    const pay_result = await client_xrpl.submitAndWait(pay_signed.tx_blob)
                    if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
                        console.log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed.hash}`)
                        sdata['xrpl'].splice(index, 1)
                        this.saveTransactions(sdata)
                    } else {
                        console.log(pay_result)
                        throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`
                    }
                }
                else {
                    for (let index = 0; index < ledger_result.result.lines.length; index++) {
                        const line = ledger_result.result.lines[index]
                        if (line.account !== xrpl_cold_wallet.address) { continue }
                        // Forward the amount
                        const send_token_tx = {
                            'TransactionType': 'Payment',
                            'Account': xahau_cold_wallet.address,
                            'Amount': transaction.meta.delivered_amount,
                            'Destination':  transaction.tx_json.Account,
                            'SourceTag': XRPL_DESTINATION_TAG,
                            'NetworkID': NetworkID
                        }

                        const pay_prepared = await client_xahau.autofill(send_token_tx)
                        const pay_signed = xahau_cold_wallet.sign(pay_prepared)
                        console.log(`Sending ${ transaction.meta.delivered_amount.value} ${ transaction.meta.delivered_amount.currency} to ${transaction.tx_json.Account}... on XAHAU`)
                        const pay_result = await client_xahau.submitAndWait(pay_signed.tx_blob)
                        if (pay_result.result.meta.TransactionResult === 'tesSUCCESS') {
                            console.log(`Transaction succeeded: https://xahau-testnet.xrpl.org/transactions/${pay_signed.hash}`)
                            sdata['xrpl'].splice(index, 1)
                            this.saveTransactions(sdata)
                        } else {
                            console.log(pay_result)
                            throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`
                        }
                    }
                }
            }
        }

        await client_xrpl.disconnect()
        await client_xahau.disconnect()
        return
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
}