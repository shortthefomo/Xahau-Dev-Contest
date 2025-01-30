'use strict'

const dotenv = require('dotenv')
const debug = require('debug')
const log = debug('main:backend')
const { XrplClient } = require('xrpl-client')
const xrpl = require('xrpl')
const decimal = require('decimal.js')


dotenv.config()


class backend {
	constructor() {
		dotenv.config()
		const client = new xrpl.Client('wss://s.altnet.rippletest.net:51233')

		Object.assign(this, {
			async run() {
				
				await this.issue()
			},
			async issue() {
				await client.connect()
				// const hot_wallet = (await client.fundWallet()).wallet
  				// const cold_wallet = (await client.fundWallet()).wallet
				// const customer_one_wallet = (await client.fundWallet()).wallet
  				// const customer_two_wallet = (await client.fundWallet()).wallet

				const hot_wallet = xrpl.Wallet.fromSecret('sahEUtpGeyKi8B6SgmoH72UweCftP', { algorithm: 'ecdsa-secp256k1' })
				const cold_wallet = xrpl.Wallet.fromSecret('saUw1KEhyY4WSBhFuFTK9h2Bw3e1R', { algorithm: 'ecdsa-secp256k1' })
				const customer_one_wallet = xrpl.Wallet.fromSecret('sh4nJGbUsQz2dc6Ytmv12KcyWsGUS', { algorithm: 'ecdsa-secp256k1' })
				const customer_two_wallet = xrpl.Wallet.fromSecret('shXT7pm2vRWB58Ch6agBNbfyibxBa', { algorithm: 'ecdsa-secp256k1' })

				log('hot_wallet', hot_wallet.address)
				log('cold_wallet', cold_wallet.address)
				log('customer_one_wallet', customer_one_wallet.address)
				log('customer_two_wallet', customer_two_wallet.address)
				
				log(`Got hot address ${hot_wallet.address} and cold address ${cold_wallet.address}.`)
				log(`Got customer_one address ${customer_one_wallet.address} and customer_two address ${customer_two_wallet.address}.`)

				// Configure issuer (cold address) settings ----------------------------------
				const cold_settings_tx = {
					'TransactionType': 'AccountSet',
					'Account': cold_wallet.address,
					'TransferRate': 0,
					'TickSize': 5,
					'Domain': '6578616D706C652E636F6D', // "example.com"
					'SetFlag': xrpl.AccountSetAsfFlags.asfDefaultRipple,
					// Using tf flags, we can enable more flags in one transaction
					'Flags': (xrpl.AccountSetTfFlags.tfDisallowXRP |
						xrpl.AccountSetTfFlags.tfRequireDestTag | xrpl.AccountSetTfFlags.tfAllowTrustLineClawback)
				}
				log('cold_settings_tx', cold_settings_tx)



				const cst_prepared = await client.autofill(cold_settings_tx)
				const cst_signed = cold_wallet.sign(cst_prepared)
				log('Sending cold address AccountSet transaction...')
				const cst_result = await client.submitAndWait(cst_signed.tx_blob)
				if (cst_result.result.meta.TransactionResult === 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${cst_signed.hash}`)
				} else {
					throw `Error sending transaction: ${cst_result}`
				}

				const cold_settings_tx2 = {
					'TransactionType': 'AccountSet',
					'Account': cold_wallet.address,
					'SetFlag': xrpl.AccountSetAsfFlags.asfAllowTrustLineClawback,
				}
				log('cold_settings_tx2', cold_settings_tx2)



				const cst_prepared2 = await client.autofill(cold_settings_tx2)
				const cst_signed2 = cold_wallet.sign(cst_prepared2)
				log('Sending cold address AccountSet transaction...')
				const cst_result2 = await client.submitAndWait(cst_signed2.tx_blob)
				if (cst_result2.result.meta.TransactionResult === 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${cst_signed2.hash}`)
				} else {
					throw `Error sending transaction: ${cst_result2}`
				}

				// Configure hot address settings --------------------------------------------

				const hot_settings_tx = {
					'TransactionType': 'AccountSet',
					'Account': hot_wallet.address,
					'Domain': '6578616D706C652E636F6D', // "example.com"
					// enable Require Auth so we can't use trust lines that users
					// make to the hot address, even by accident:
					'SetFlag': xrpl.AccountSetAsfFlags.asfRequireAuth,
					'Flags': (xrpl.AccountSetTfFlags.tfDisallowXRP |
							xrpl.AccountSetTfFlags.tfRequireDestTag)
				}

				const hst_prepared = await client.autofill(hot_settings_tx)
				const hst_signed = hot_wallet.sign(hst_prepared)
				log('Sending hot address AccountSet transaction...')
				const hst_result = await client.submitAndWait(hst_signed.tx_blob)
				if (hst_result.result.meta.TransactionResult == "tesSUCCESS") {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${hst_signed.hash}`)
				} else {
					throw `Error sending transaction: ${hst_result.result.meta.TransactionResult}`
				}

				// Create trust line from hot to cold address --------------------------------
				const currency_code = 'BAR'
				const trust_set_tx = {
					'TransactionType': 'TrustSet',
					'Account': hot_wallet.address,
					'LimitAmount': {
					'currency': currency_code,
					'issuer': cold_wallet.address,
					'value': '10000000000' // Large limit, arbitrarily chosen
					}
				}

				const ts_prepared = await client.autofill(trust_set_tx)
				const ts_signed = hot_wallet.sign(ts_prepared)
				log('Creating trust line from hot address to issuer...')
				const ts_result = await client.submitAndWait(ts_signed.tx_blob)
				if (ts_result.result.meta.TransactionResult == "tesSUCCESS") {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_signed.hash}`)
				} else {
					throw `Error sending transaction: ${ts_result.result.meta.TransactionResult}`
				}



				// Create trust line from customer_one to cold address --------------------------------
				const trust_set_tx2 = {
					'TransactionType': 'TrustSet',
					'Account': customer_one_wallet.address,
					'LimitAmount': {
					'currency': currency_code,
					'issuer': cold_wallet.address,
					'value': "10000000000" // Large limit, arbitrarily chosen
					}
				}

				const ts_prepared2 = await client.autofill(trust_set_tx2)
				const ts_signed2 = customer_one_wallet.sign(ts_prepared2)
				log('Creating trust line from customer_one address to issuer...')
				const ts_result2 = await client.submitAndWait(ts_signed2.tx_blob)
				if (ts_result2.result.meta.TransactionResult == "tesSUCCESS") {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_signed2.hash}`)
				} else {
					throw `Error sending transaction: ${ts_result2.result.meta.TransactionResult}`
				}

				const trust_set_tx3 = {
					'TransactionType': 'TrustSet',
					'Account': customer_two_wallet.address,
					'LimitAmount': {
					'currency': currency_code,
					'issuer': cold_wallet.address,
					'value': '10000000000' // Large limit, arbitrarily chosen
					}
				}

				const ts_prepared3 = await client.autofill(trust_set_tx3)
				const ts_signed3 = customer_two_wallet.sign(ts_prepared3)
				log('Creating trust line from customer_two address to issuer...')
				const ts_result3 = await client.submitAndWait(ts_signed3.tx_blob)
				if (ts_result3.result.meta.TransactionResult == 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_signed3.hash}`)
				} else {
					throw `Error sending transaction: ${ts_result3.result.meta.TransactionResult}`
				}




				// Send token ----------------------------------------------------------------
				let issue_quantity = '3800'

				const send_token_tx = {
					'TransactionType': 'Payment',
					'Account': cold_wallet.address,
					'DeliverMax': {
						'currency': currency_code,
						'value': issue_quantity,
						'issuer': cold_wallet.address
					},
					'Destination': hot_wallet.address,
					'DestinationTag': 1 // Needed since we enabled Require Destination Tags
										// on the hot account earlier.
				}

				const pay_prepared = await client.autofill(send_token_tx)
				const pay_signed = cold_wallet.sign(pay_prepared)
				log(`Cold to hot - Sending ${issue_quantity} ${currency_code} to ${hot_wallet.address}...`)
				const pay_result = await client.submitAndWait(pay_signed.tx_blob)
				if (pay_result.result.meta.TransactionResult == "tesSUCCESS") {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed.hash}`)
				} else {
					log(pay_result)
					throw `Error sending transaction: ${pay_result.result.meta.TransactionResult}`
				}


				issue_quantity = '100'
				const send_token_tx2 = {
					'TransactionType': 'Payment',
					'Account': hot_wallet.address,
					'DeliverMax': {
					'currency': currency_code,
					'value': issue_quantity,
					'issuer': cold_wallet.address
					},
					'Destination': customer_one_wallet.address,
					'DestinationTag': 1 // Needed since we enabled Require Destination Tags
										// on the hot account earlier.
				}

				const pay_prepared2 = await client.autofill(send_token_tx2)
				const pay_signed2 = hot_wallet.sign(pay_prepared2)
				log(`Hot to customer_one - Sending ${issue_quantity} ${currency_code} to ${customer_one_wallet.address}...`)
				const pay_result2 = await client.submitAndWait(pay_signed2.tx_blob)
				if (pay_result2.result.meta.TransactionResult == 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed2.hash}`)
				} else {
					log(pay_result2)
					throw `Error sending transaction: ${pay_result2.result.meta.TransactionResult}`
				}
				issue_quantity = '24'
				const send_token_tx3 = {
					'TransactionType': 'Payment',
					'Account': customer_one_wallet.address,
					'DeliverMax': {
					'currency': currency_code,
					'value': issue_quantity,
					'issuer': cold_wallet.address
					},
					'Destination': customer_two_wallet.address,
					'DestinationTag': 1 // Needed since we enabled Require Destination Tags
										// on the hot account earlier.
				}

				const pay_prepared3 = await client.autofill(send_token_tx3)
				log('pay_prepared3', pay_prepared3)
				const pay_signed3 = customer_one_wallet.sign(pay_prepared3)
				log(`Customer_one to customer_two - Sending ${issue_quantity} ${currency_code} to ${customer_two_wallet.address}...`)
				const pay_result3 = await client.submitAndWait(pay_signed3.tx_blob)
				if (pay_result3.result.meta.TransactionResult == 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${pay_signed3.hash}`)
				} else {
					log(pay_result3)
					throw `Error sending transaction: ${pay_result3.result.meta.TransactionResult}`
				}


				// // Check balances ------------------------------------------------------------
				// log('Getting hot address balances...')
				// const hot_balances = await client.request({
				// 	command: 'account_lines',
				// 	account: hot_wallet.address,
				// 	ledger_index: 'validated'
				// })
				// log(hot_balances.result)

				// log('Getting cold address balances...')
				// const cold_balances = await client.request({
				// 	command: 'gateway_balances',
				// 	account: cold_wallet.address,
				// 	ledger_index: 'validated',
				// 	hotwallet: [hot_wallet.address]
				// })
				// log(JSON.stringify(cold_balances.result, null, 2))



				// const cold_settings_tx = {
				// 	'TransactionType': 'AccountSet',
				// 	'Account': cold_wallet.address,
				// 	'TransferRate': 0,
				// 	'TickSize': 5,
				// 	'Domain': '6578616D706C652E636F6D', // "example.com"
				// 	'SetFlag': xrpl.AccountSetAsfFlags.asfDefaultRipple,
				// 	// Using tf flags, we can enable more flags in one transaction
				// 	'Flags': (xrpl.AccountSetTfFlags.tfDisallowXRP |
				// 		xrpl.AccountSetTfFlags.tfRequireDestTag | xrpl.AccountSetTfFlags.tfAllowTrustLineClawback)
				// }
				// log('cold_settings_tx', cold_settings_tx)



				// const cst_prepared = await client.autofill(cold_settings_tx)
				// const cst_signed = cold_wallet.sign(cst_prepared)


				// // Clawback ------------------------------------------------------------
				// const clawback_tx = {
				// 	'TransactionType': 'Clawback',
				// 	'Account': cold_wallet.address,
				// 	'Amount': {
				// 		'currency': currency_code,
				// 		'issuer': customer_two_wallet.address,
				// 		'value': '12'
				// 	}
				// }

				// const ts_clawback_prepared = await client.autofill(clawback_tx)
				// log('ts_clawback_prepared', ts_clawback_prepared)
				// const ts_clawback_signed = cold_wallet.sign(ts_clawback_prepared)
				// log('Clawing back tokens from client_two...')
				// const ts_clawback_result = await client.submitAndWait(ts_clawback_signed.tx_blob)
				// if (ts_clawback_result.result.meta.TransactionResult == 'tesSUCCESS') {
				// 	log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_clawback_signed.hash}`)
				// } else {
				// 	throw `Error sending transaction: ${ts_clawback_result.result.meta.TransactionResult}`
				// }


				// Return to cold_wallet ------------------------------------------------------------
				const return_tx = {
					'TransactionType': 'Payment',
					'Account': customer_two_wallet.address,
					'Destination': cold_wallet.address,
					'DestinationTag': 21337,
					'Amount': {
						'currency': currency_code,
						'issuer': cold_wallet.address,
						'value': '12'
					}
				}

				const ts_return_prepared = await client.autofill(return_tx)
				log('ts_return_prepared', ts_return_prepared)
				const ts_return_signed = customer_two_wallet.sign(ts_return_prepared)
				log('Return tokens from client_two to cold_wallet...')
				const ts_return_result = await client.submitAndWait(ts_return_signed.tx_blob)
				if (ts_return_result.result.meta.TransactionResult == 'tesSUCCESS') {
					log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_return_signed.hash}`)
				} else {
					throw `Error sending transaction: ${ts_return_result.result.meta.TransactionResult}`
				}

				// // Return to cold_wallet ------------------------------------------------------------
				// const return_cold_tx = {
				// 	'TransactionType': 'Payment',
				// 	'Account': hot_wallet.address,
				// 	'Destination': cold_wallet.address,
				// 	'DestinationTag': 21337,
				// 	'Amount': {
				// 		'currency': currency_code,
				// 		'issuer': cold_wallet.address,
				// 		'value': '12'
				// 	}
				// }

				// const ts_return_cold_prepared = await client.autofill(return_cold_tx)
				// log('ts_return_prepared', ts_return_prepared)
				// const ts_return_cold_signed = hot_wallet.sign(ts_return_cold_prepared)
				// log('Return tokens from client_two to hot_wallet...')
				// const ts_return_cold_result = await client.submitAndWait(ts_return_cold_signed.tx_blob)
				// if (ts_return_cold_result.result.meta.TransactionResult == 'tesSUCCESS') {
				// 	log(`Transaction succeeded: https://testnet.xrpl.org/transactions/${ts_return_cold_signed.hash}`)
				// } else {
				// 	throw `Error sending transaction: ${ts_return_cold_result.result.meta.TransactionResult}`
				// }

				// Check balances ------------------------------------------------------------
				log('Getting hot address balances...')
				const hot_balances_end = await client.request({
					command: 'account_lines',
					account: hot_wallet.address,
					ledger_index: 'validated'
				})
				log(hot_balances_end.result)

				log('Getting cold address balances...')
				const cold_balances_end = await client.request({
					command: 'gateway_balances',
					account: cold_wallet.address,
					ledger_index: 'validated',
					hotwallet: [hot_wallet.address]
				})
				log(JSON.stringify(cold_balances_end.result, null, 2))
			}
		})
	}
}

const main = new backend()
main.run()