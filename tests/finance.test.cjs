const {test}=require('node:test'),assert=require('node:assert/strict');const f=require('../src/finance.cjs');
test('debit SMS',()=>{const r=f.parseBankSms('Rs.1,250.00 debited from A/c XX1234 at SWIGGY');assert.equal(r.amount,1250);assert.equal(r.kind,'debit');assert.equal(r.category,'Food')});
test('credit SMS',()=>{assert.equal(f.parseBankSms('INR 2500 credited to account XX3456').kind,'credit')});
test('reject OTP',()=>assert.equal(f.parseBankSms('OTP 123456 for INR 500'),null));
test('exclude internal transfers from expenses',()=>assert.equal(f.summarize([{kind:'debit',amount:100,category:'Transfers'}]).expenses,0));

test('Prolific EUR completed payout',()=>{const x=f.parseProlificEmail('Prolific: Your payout of €12.45 has been paid');assert.equal(x.currency,'EUR');assert.equal(x.amount,12.45);assert.equal(x.kind,'credit')});
test('Prolific USD completed payout',()=>{const x=f.parseProlificEmail('Prolific payment received $8.50');assert.equal(x.currency,'USD');assert.equal(x.amount,8.5)});
test('Prolific pending payout not recorded',()=>assert.equal(f.parseProlificEmail('Prolific payout requested for $10.00; payment pending'),null));
test('foreign earnings not incorrectly added as INR',()=>assert.equal(f.summarize([{kind:'credit',amount:10,currency:'EUR',category:'Other'}]).income,0));

test('Google Pay sent ₹200 SMS',()=>{const x=f.parseBankSms('Rs.200.00 paid to ABC via Google Pay UPI Ref 123456');assert.equal(x.kind,'debit');assert.equal(x.amount,200)});
test('UPI transferred to merchant',()=>assert.equal(f.parseBankSms('INR 200 transferred to XYZ using UPI').kind,'debit'));
test('UPI received money',()=>assert.equal(f.parseBankSms('INR 200 received from XYZ via UPI').kind,'credit'));
test('Do not count ambiguous UPI message',()=>assert.equal(f.parseBankSms('Your UPI limit is INR 200'),null));

test('BOB Rs.200 Dr from account and Cr to recipient is debit',()=>{
 const sms='Rs.200.00 Dr. from A/C XXXXXX5109 and Cr. to paytmqr71fx88@ptys. Ref:628325978778. AvlBal:Rs130.07(2026:10:10 11:57:56). Not you? Call BOB';
 const x=f.parseBankSms(sms);assert.equal(x.kind,'debit');assert.equal(x.amount,200);
});
test('BOB Rs.1500 Dr from account is debit',()=>{
 const x=f.parseBankSms('Rs.1500.00 Dr. from A/C XXXXXX5109 and Cr. to recipient@oksbi. Ref:628266005658. AvlBal:Rs471.11');
 assert.equal(x.kind,'debit');assert.equal(x.amount,1500);
});
test('BOB account credited with INR 1000 is credit',()=>{
 const x=f.parseBankSms('Dear BOB UPI User: Your account is credited with INR 1000.00 on 2026-09-22 by UPI Ref No 130065147679; AvlBal: Rs2133.70 - BOB');
 assert.equal(x.kind,'credit');assert.equal(x.amount,1000);
});
test('Balance-only SMS is not a transaction',()=>assert.equal(f.parseBankSms('AvlBal:Rs130.07'),null));
