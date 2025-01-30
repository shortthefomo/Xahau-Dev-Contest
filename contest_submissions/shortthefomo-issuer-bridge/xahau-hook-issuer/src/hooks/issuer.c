/**
 * This hook just accepts any transaction coming through it
 */
#include "hookapi.h"
#include <stdint.h>

#define NOPE(x) rollback(SBUF(x), __LINE__)
#define MIN_LEDGER_LIMIT 21600     // 21600 is 1 day, 324000 ledger is 15 days. Changed to 50 ledger for testing
#define MAX_LEDGER_LIMIT 648000 // 30 days
#define ttPAYMENT 0

uint8_t msg_buf[30] = "You must wait 0000000 ledgers";

int64_t hook(uint32_t reserved ) {
    int64_t tt = otxn_type();
    if (tt != ttPAYMENT)
        DONE("Issuance: Passing non-PAYMENT txn.");

    // the wallet this hook is installed on
    uint8_t hook_wallet[20];
    hook_account(SBUF(hook_wallet));

    // ignore out going transactions
    uint8_t account[20];
    otxn_field(SBUF(account), sfAccount);

    if (BUFFER_EQUAL_20(hook_wallet, account))
        DONE("Issuance: Outgoing Transaction");

    // currency code
    // uint8_t currency[20] = {0,0,0,0, 0,0,0,0, 0,0,0,0, 'B', 'A', 'R', 0,0,0,0,0};
    // TRACEHEX(currency);
    uint8_t currency[20];
    if (hook_param(SBUF(currency), "C", 1)!= 20)
        NOPE("Issuance: Misconfigured C, not set as Hook Parameter");
    TRACESTR(currency);

    // the account we are issuing a new token to
    uint8_t hot_wallet[20];
    if (hook_param(SBUF(hot_wallet), "H", 1) != 20)
        NOPE("Issuance: Misconfigured H, not set as Hook Parameter");

    // the amount that is issued at each interval
    uint64_t amount_param;
    if (hook_param(SVAR(amount_param), "A", 1) != 8)
        NOPE("Issuance: Misconfigured A, not set as Hook Parameter");
    
    // the number of ledgers to pass before allowing further issuance
    uint64_t ledger_param;
    if (hook_param(SVAR(ledger_param), "L", 1) != 8)
        NOPE("Issuance: Misconfigured L, not set as Hook Parameter");

    if (float_int(ledger_param, 0, 1) < MIN_LEDGER_LIMIT)
        NOPE("Issuance: Ledger limit must be greater than 21600(1 day).");

    if (float_int(ledger_param, 0, 1) > MAX_LEDGER_LIMIT)
        NOPE("Issuance: Ledger limit less than 648,000 (30 days).");        


    // the supply cap to issue via this hook
    uint64_t supply_cap_param;
    if(hook_param(SVAR(supply_cap_param), "SC", 2) != 8)
        NOPE("Issuance: Misconfigured SC, not set as Hook Parameter");

    // state of what has been issued
    uint64_t issued = 0;
    state(SVAR(issued), "SCAP", 4);

    //issued = float_int(issued, 0, 1);
    supply_cap_param = float_int(supply_cap_param, 0, 1);

    TRACEVAR(issued);
    TRACEVAR(supply_cap_param);

    if (issued >= supply_cap_param)
        DONE("Issuance: total supply has been issued.");

    // last time the hook issued tokens
    uint32_t last_release = 0;
    state(SVAR(last_release), "LAST", 4);
    TRACEVAR(last_release);

    // ignore XAH transactions
    uint8_t amount[48];
    if (otxn_field(SBUF(amount), sfAmount) != 48)
        DONE("XAH, Transaction accepted!");


    // check if a trustline exists between the sender and the hook for the currency [ BAR ]
    uint8_t keylet[34];
    if (util_keylet(SBUF(keylet), KEYLET_LINE, SBUF(hook_wallet), SBUF(hot_wallet), SBUF(currency)) != 34)
        rollback(SBUF("Issuance: Internal error, could not generate keylet"), 10);


    // check the interval between issuance and limit it
    uint32_t current_ledger =  ledger_seq();
    ledger_param = float_int(ledger_param, 0, 1);

    TRACEVAR(current_ledger);
    TRACEVAR(ledger_param);

    uint32_t lgr_elapsed = last_release + ledger_param;
    TRACEVAR(lgr_elapsed);
    if (lgr_elapsed > current_ledger)
    {
        lgr_elapsed = last_release + ledger_param - current_ledger;
        msg_buf[14] += (lgr_elapsed / 1000000) % 10;
        msg_buf[15] += (lgr_elapsed /  100000) % 10;
        msg_buf[16] += (lgr_elapsed /   10000) % 10;
        msg_buf[17] += (lgr_elapsed /    1000) % 10;
        msg_buf[18] += (lgr_elapsed /     100) % 10;
        msg_buf[19] += (lgr_elapsed /      10) % 10;
        msg_buf[20] += (lgr_elapsed          ) % 10;
        DONE(msg_buf);
    }

    // transform the issuance into xfl so we can issue the value
    int64_t amount_xfl = float_set(0, float_int(amount_param, 0, 1));

    TRACEVAR(amount_param);
    TRACEXFL(amount_xfl);

    // we need to dump the iou amount into a buffer
    // by supplying -1 as the fieldcode we tell float_sto not to prefix an actual STO header on the field
    uint8_t amt_out[48];
    if (float_sto(amt_out - 1 ,  49, SBUF(currency), SBUF(hook_wallet), amount_xfl, sfAmount) < 0)
        NOPE("Issuance: Could not dump xfl amount into sto, bailing.");   

    // set the currency code and issuer in the amount field
    for (int i = 0; GUARD(20),i < 20; ++i)
    {
        amt_out[i + 28] = hook_wallet[i];
        amt_out[i +  8] = currency[i];
    }
    
    // update issued amount
    issued = issued + float_int(amount_param, 0, 1);
    TRACEVAR(issued);
    if (state_set(SVAR(issued), "SCAP", 4) != 8)
        NOPE("Issuance: Could not set issued state entry, bailing.");

    // update the last_release
    if (state_set(SVAR(current_ledger), "LAST", 4) != 4)
        NOPE("Issuance: Could not set last release state entry, bailing.");

    etxn_reserve(1);
    uint8_t txn[PREPARE_PAYMENT_SIMPLE_TRUSTLINE_SIZE];

    // issue the tokens
    PREPARE_PAYMENT_SIMPLE_TRUSTLINE(txn, amt_out, hot_wallet, 0, 0);


    uint8_t emithash[32];
    if (emit(SBUF(emithash), SBUF(txn)) != 32)
        NOPE("Issuance: Failed please try again later.");

    DONE("Issuance: Amount issued successfully.");

    _g(1,1);   // every hook needs to import guard function and use it at least once
    // unreachable
    return 0;
}