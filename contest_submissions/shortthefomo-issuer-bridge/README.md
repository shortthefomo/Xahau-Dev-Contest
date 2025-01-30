# Xahau Issuer Hook and Evernode Bridge

Basic idea, is to have a front end (not delivered here as this is a POC) that would allow a user on the network to scan a QR code. Which would then trigger these to be deployed into the network.
1. creating them a new token
2. attaching the hook to the issuer
3. deploys a bridge for the token

As users now move tokens from one network to the other, the hook controlls the issuance of new tokens into the network. Evertime value is returned to the issuer, it then reissues more tokens at the intervals defined on the hook and up to the supply cap set. Now to get users todo that interaction they are provided with a bridge. This allows them to move tokens from one network to the other, as this is a bi-directional bridge.

So in effect if users dont use the bridge no new value is created. But if they do the idea is then to get the bridge to fund its self and running of the bridge.

## Xahau Issuer Hook
This hooks purpose is to issue a token to a network, define the supply cap and independently issue new tokens to a hot wallet (later on these tokens should be used to build liquidity the AMM a future body of work).

### Installation
Setting up of accounts and trustlines needs to be perfromed before hand. In the hook-issuer project folder there are two sccripts todo so run `yarn xahau` and `yarn xrpl`. You are required to create x4 accounts on both networks XRPL-TESTNET and XAHAU-TESTNET. The code would need to have those secrets used before running the account step.

Next one then needs to install the hook in the hook-issuer project. With the following paramters, using the cold wallet you had setup in the previous step. 
This hook has 5 parameters.
- H - hot wallet, the account we are issuing a new token to
- A - amount, the amount that is issued at each interval
- L - ledgers, the number of ledgers to pass before allowing further issuance
- SC - supply cap, the supply cap this hook will issue tokens up to before stopping
- C - currency, the currency code 


With this you now are left with x4 accounts 
- the cold_wallet (token issuer)
- the hot_wallet (where new tokens are delivered to)
- alice a test account
- bob a test account



## Evernode Bridge
This Evernode Contracts job is to facilitate the moving of tokens from one network to another this example is using XRPL and XAHAU, however othe networks that can issue tokens could be substituted.

This is not a deployable contract into the network at this point as it is still far to rudementory at this stage. You will need to install hpdevkit https://docs.evernode.org/en/latest/sdk/hotpocket/hpdevkit/overview.html


### Installation
First one needs to update the keys used in the srouce code in evernode-bridge in the files issuer.js and bridge.js to those you used and created for the hook. We are using the fact that a users rAddress is the same on both networks here (complicates other networks).

Next in that project folder run 
```
yarn install
yarn start
```

This will deploy the Evernode Contract onto a local Evernode cluster on your machine. The bridge is now running.

What this now does is when users of this token sends back tokens to the issuer on the network they are on the contract detects this payment and then issues them that same value they just returned to the issuer on the opposite network. The return payment to the issuer requires the user enter the DestinationTag to the network ID they are wanting their value moved to. *In this code 1 is the XRPL-TEST 21338 is the XAHAU-TESTNET*.

The contract will also return a value if the user enters an unknown destination tag.


Assumptions that still need work on.
- xPOP additional part should use a xPOP at each bridge transaction.
- multisi there was not enough time to add this functionality in but ive commented in the code and linked off to a previous example ive done so with https://github.com/shortthefomo/mycontract/blob/71db56ec9d9fc76bde1c0aac188f00368a3c5904/src/mycontract.js#L150 .
- build custom  Evernode container that houses XAHAU and XRPL submission nodes, other work im busy with so that the contract does not rely on external nodes but is self sufficient.

Hope is to continue this work through the year.


## Video 
TODO---



## Disclaimer
This is by no means a complete functional product, but simply a proof of concept. Use at your own risk!