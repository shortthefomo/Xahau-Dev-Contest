const HotPocket = require('hotpocket-nodejs-contract')
const { bridge } = require('./bridge')
const { issuer } = require('./issuer')

// HotPocket smart contract is defined as a function which takes the HotPocket contract context as an argument.
// This function gets invoked every consensus round and whenever a user sends a out-of-concensus read-request.
async function contract(ctx) {
    console.log('starting contract')
    // Create our application logic component.
    // This pattern allows us to test the application logic independently of HotPocket.
    const app = new issuer()
    const bridge_instance = new bridge()
    const bridge_issuer = new issuer()
    
    // Wire-up output emissions from the application before we pass user inputs to it.
    app.sendOutput = async (user, output) => {
        await user.send(output)
    }

    // In 'readonly' mode, nothing our contract does will get persisted on the ledger. The benefit is
    // readonly messages gets processed much faster due to not being subjected to consensus.
    // We should only use readonly mode for returning/replying data for the requesting user.
    //
    // In consensus mode (NOT read-only), we can do anything like persisting to data storage and/or
    // sending data to any connected user at the time. Everything will get subjected to consensus so
    // there is a time-penalty.
    const isReadOnly = ctx.readonly

    // Process user inputs.
    // Loop through list of users who have sent us inputs.
    for (const user of ctx.users.list()) {

        // Loop through inputs sent by each user.
        for (const input of user.inputs) {

            // Read the data buffer sent by user (this can be any kind of data like string, json or binary data).
            const buf = await ctx.users.read(input)

            // Let's assume all data buffers for this contract are JSON.
            // In real-world apps, we need to gracefully filter out invalid data formats for our contract.
            const message = JSON.parse(buf)

            // Pass the JSON message to our application logic component.
            await app.handleRequest(user, message, isReadOnly)
        }
    }

    console.log('starting bridge processing')
    // first send any tx we have not completed.
    await bridge_issuer.issue(isReadOnly)
    
    // look for other transactions
    await bridge_instance.process({ cmd: 'process'}, isReadOnly)
}

const hpc = new HotPocket.Contract()
hpc.init(contract)