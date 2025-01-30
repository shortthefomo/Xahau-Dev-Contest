# Xahau Issuer Hook and Evernode Bridge

Basic idea, is to have a front end (not delivered here as this is a POC) that would allow a user on the network to scan a QR code. Which would then trigger these to bedeployed into the network.
1. createing them a new token
2. deploys a bridge for the token


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




## Video 
TODO---


##Tweets

First Mandatory Tweet announcing your participation:

Link to Tweet: [https://x.com/shortthefomo/status/1882487499366560095?s=46](https://x.com/shortthefomo/status/1882487499366560095?s=46)

Second Mandatory Tweet upon submission for final review:
[Link to Tweet: https://x.com/XRPLWin/status/1884545566513717683](https://x.com/shortthefomo/status/1884982622754881618?s=46)
