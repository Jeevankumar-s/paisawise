function monthlySpend(rows,category,now=Date.now()){const d=new Date(now),year=d.getFullYear(),month=d.getMonth();return rows.filter(r=>r.kind==='debit'&&r.category===category&&r.timestamp&&new Date(r.timestamp).getFullYear()===year&&new Date(r.timestamp).getMonth()===month).reduce((s,r)=>s+r.amount,0)}
function monthlyReport(rows){const months={};for(const r of rows){if(!r.timestamp)continue;const key=new Date(r.timestamp).toISOString().slice(0,7);const item=months[key]||(months[key]={month:key,income:0,spending:0});if(r.kind==='credit')item.income+=r.amount;else item.spending+=r.amount}return Object.values(months).sort((a,b)=>b.month.localeCompare(a.month)).slice(0,12)}
function recurring(rows){const groups={};for(const r of rows){if(r.kind!=='debit'||!r.timestamp)continue;const label=String(r.description||'').toLowerCase().replace(/\d+/g,'').replace(/[^a-z ]/g,' ').trim().slice(0,45);if(label.length<5)continue;const key=label+'|'+Math.round(r.amount/10);(groups[key]||(groups[key]=[])).push(r)}return Object.values(groups).filter(group=>group.length>=2).map(group=>({label:String(group[0].description).slice(0,48),amount:group.reduce((s,r)=>s+r.amount,0)/group.length,count:group.length})).slice(0,12)}
module.exports={monthlySpend,monthlyReport,recurring};

function spendShield(rows,budgets={},now=Date.now()){
 const current=new Date(now),start=new Date(current.getFullYear(),current.getMonth(),1).getTime();
 const next=new Date(current.getFullYear(),current.getMonth()+1,1).getTime();
 const elapsed=Math.max(1,Math.floor((now-start)/86400000)+1),days=Math.round((next-start)/86400000);
 const debits=rows.filter(r=>r.kind==='debit'&&(!r.currency||r.currency==='INR')&&Number.isFinite(r.amount)&&r.amount>0&&Number.isFinite(r.timestamp));
 const month=debits.filter(r=>r.timestamp>=start&&r.timestamp<next);
 const spent=month.reduce((s,r)=>s+r.amount,0);
 const projection=spent/elapsed*days;
 const alerts=[];
 for(const [category,limit] of Object.entries(budgets)){
  if(!Number.isFinite(limit)||limit<=0)continue;
  const used=month.filter(r=>r.category===category).reduce((s,r)=>s+r.amount,0);
  if(used>=limit)alerts.push({kind:'budget',title:category+' budget reached',detail:'Spent ₹'+Math.round(used)+' of ₹'+Math.round(limit)+'.',priority:1});
  else if(used>=limit*.8)alerts.push({kind:'budget',title:category+' budget nearly full',detail:'Only ₹'+Math.round(limit-used)+' left this month.',priority:2});
 }
 const sorted=[...debits].sort((a,b)=>a.timestamp-b.timestamp);
 for(let i=0;i<sorted.length;i++){
  const row=sorted[i];if(row.timestamp<start)continue;
  const matches=sorted.slice(Math.max(0,i-30),i).filter(x=>row.timestamp-x.timestamp>=0&&row.timestamp-x.timestamp<=15*60000&&Math.abs(x.amount-row.amount)<.01&&x.id!==row.id);
  if(matches.length&&!(row.description||'').toLowerCase().includes('subscription')){
   alerts.push({kind:'duplicate',title:'Possible repeated payment',detail:'₹'+Math.round(row.amount)+' appears more than once within 15 minutes. Check before reporting it.',priority:1});
   break;
  }
 }
 const previous=debits.filter(r=>r.timestamp<start).slice(-100);
 if(previous.length>=5){
  const amounts=previous.map(r=>r.amount).sort((a,b)=>a-b);
  const median=amounts[Math.floor(amounts.length/2)];
  const large=month.find(r=>r.amount>=Math.max(500,median*3));
  if(large)alerts.push({kind:'unusual',title:'Larger-than-usual expense',detail:'₹'+Math.round(large.amount)+' is well above your earlier typical payment. Review if expected.',priority:2});
 }
 const totalBudget=Object.values(budgets).filter(v=>Number.isFinite(v)&&v>0).reduce((s,v)=>s+v,0);
 if(totalBudget>0&&projection>totalBudget*1.1)alerts.push({kind:'projection',title:'Monthly spending may exceed budgets',detail:'At the current pace: ~₹'+Math.round(projection)+' this month. This is an estimate.',priority:2});
 return {spent,projection,daysRemaining:Math.max(0,Math.ceil((next-now)/86400000)),totalBudget,remainingBudget:totalBudget?Math.max(0,totalBudget-spent):null,alerts:alerts.sort((a,b)=>a.priority-b.priority).slice(0,5)};
}
module.exports.spendShield=spendShield;
