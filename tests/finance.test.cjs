const {test}=require('node:test'),assert=require('node:assert/strict');const f=require('../src/finance.cjs');
test('debit SMS',()=>{const r=f.parseBankSms('Rs.1,250.00 debited from A/c XX1234 at SWIGGY');assert.equal(r.amount,1250);assert.equal(r.kind,'debit');assert.equal(r.category,'Food')});
test('credit SMS',()=>{assert.equal(f.parseBankSms('INR 2500 credited to account XX3456').kind,'credit')});
test('reject OTP',()=>assert.equal(f.parseBankSms('OTP 123456 for INR 500'),null));
test('exclude internal transfers from expenses',()=>assert.equal(f.summarize([{kind:'debit',amount:100,category:'Transfers'}]).expenses,0));
