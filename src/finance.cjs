const categories=['Food','Shopping','Groceries','Transport','Bills','Health','Salary','Transfers','Other'];
function classify(description,kind){const t=description.toLowerCase();if(kind==='credit'&&/salary|payroll|wages/.test(t))return 'Salary';if(/swiggy|zomato|restaurant|cafe|food/.test(t))return 'Food';if(/amazon|flipkart|myntra|shopping/.test(t))return 'Shopping';if(/grocery|supermarket|vegetable|bigbasket|zepto/.test(t))return 'Groceries';if(/uber|ola|petrol|fuel|metro|bus/.test(t))return 'Transport';if(/electricity|recharge|broadband|rent|bill/.test(t))return 'Bills';if(/hospital|pharmacy|medical/.test(t))return 'Health';if(/self transfer|own account/.test(t))return 'Transfers';return 'Other'}
function parseBankSms(body){
 const s=String(body||'');
 if(/\b(otp|one.time password|verification code|login code|passcode)\b/i.test(s))return null;
 const m=s.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
 if(!m)return null;
 const amount=Number(m[1].replace(/,/g,''));
 if(!Number.isFinite(amount)||amount<=0)return null;
 // BOB: "Rs.200.00 Dr. from A/C ... and Cr. to recipient" is one debit.
 const bankDebit=/\bDr\.?\s+from\s+(?:A\/C|account|acct)\b/i.test(s);
 const bankCredit=/\baccount\s+is\s+credited\b/i.test(s);
 const debit=bankDebit||(!bankCredit&&/\b(debited|spent|withdrawn|paid to|payment (?:of|to|successful|completed)|sent to|transferred to|purchase|upi debit|paid via|paid using)\b/i.test(s));
 const credit=bankCredit||(!bankDebit&&/\b(credited|received|deposited|refund|money received|received from|upi credit)\b/i.test(s));
 if(debit===credit)return null;
 const kind=debit?'debit':'credit';
 const account=(s.match(/(?:a\/c|account|acct|card)\s*(?:no\.?\s*)?[xX*\-\s]*(\d{3,4})/i)||[])[1]||null;
 return {amount,kind,account,currency:'INR',category:classify(s,kind),description:s.slice(0,180)};
}
function parseProlificEmail(text){
 const s=String(text||'');
 if(!/prolific/i.test(s)||!/paid|payment|payout|cashout|cash out|transferred|received|credited|sent you|has been sent|successfully processed/i.test(s))return null;
 if(/payment method|payment details|request a payout|cash out now|pending payment|payment pending|payout requested/i.test(s)&&!/has been paid|payment received|payout completed|successfully paid/i.test(s))return null;
 const match=s.match(/(€|EUR|US\$|\$|USD|£|GBP)\s*([\d,]+(?:\.\d{1,2})?)/i)||s.match(/([\d,]+(?:\.\d{1,2})?)\s*(EUR|USD|GBP)/i);
 if(!match)return null;
 const amountText=match[0].match(/[\d,]+(?:\.\d{1,2})?/)[0];
 const symbol=match[0].replace(amountText,'').trim().toUpperCase();
 const currency=/€|EUR/.test(symbol)?'EUR':/£|GBP/.test(symbol)?'GBP':'USD';
 const amount=Number(amountText.replace(/,/g,''));if(!Number.isFinite(amount)||amount<=0)return null;
 return {kind:'credit',amount,currency,category:'Other',description:'Prolific payout · '+currency+' '+amount.toFixed(2)};
}
function summarize(rows){let income=0,expenses=0;const byCategory={};for(const r of rows){if(r.category==='Transfers'||(r.currency&&r.currency!=='INR'))continue;if(r.kind==='credit')income+=r.amount;else{expenses+=r.amount;byCategory[r.category]=(byCategory[r.category]||0)+r.amount}}return {income,expenses,savings:income-expenses,savingsRate:income?((income-expenses)/income)*100:0,byCategory}}
function insights(rows){const s=summarize(rows);const ranked=Object.entries(s.byCategory).sort((a,b)=>b[1]-a[1]);const tips=[];if(s.income===0)tips.push('Add your income to calculate a meaningful savings rate.');if(s.income>0&&s.savingsRate<20)tips.push('Aim to save 20% of your income. Review flexible expenses first.');if(ranked.length){const [cat,value]=ranked[0];tips.push(`${cat} is your largest expense (₹${value.toFixed(0)}). Try reducing it by 10% to save ₹${(value*.1).toFixed(0)}.`)}if(s.savings<0)tips.push('Your recorded expenses exceed income. Review recurring bills and discretionary purchases.');return tips}
module.exports={categories,classify,parseBankSms,parseProlificEmail,summarize,insights};
