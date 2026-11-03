'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {analyze,isCard,csvCell,cashScenario,debtPlan}=require('../reports');
function fixture(){
 return{data:{bills:[{id:'card',name:'Apple Card',category:'Debt',payMethod:'manual'},{id:'loan',name:'Upstart Loan',category:'Debt'}],income:[{id:'pay'}],oneTimeEvents:[{id:'repair',type:'adjustment',name:'Repair',category:'Home'},{id:'corr',type:'adjustment',name:'Ending balance reconciliation'}]},months:[{key:'2026-11',starting:1000,ending:1500,days:[{date:'2026-11-01',ending:1500}],rows:[{iso:'2026-11-01',sourceId:'pay',name:'Paycheck',amount:2000,type:'income'},{iso:'2026-11-01',sourceId:'card',name:'Apple Card',amount:-100,type:'manual'},{iso:'2026-11-01',sourceId:'loan',name:'Upstart Loan',amount:-500,type:'auto'},{iso:'2026-11-01',sourceId:'repair',name:'Repair',amount:-200,type:'balance-correction'},{iso:'2026-11-01',name:'Fund Spending Account',amount:-1000,type:'transfer'},{iso:'2026-11-01',sourceId:'corr',name:'Ending balance reconciliation',amount:300,type:'balance-correction'}]}]};
}
test('reports separate debt, transfers, and adjustments while reconciling to calendar balances',()=>{
 const m=analyze(fixture()).months[0];
 assert.equal(m.income,2000);assert.equal(m.expenses,800);assert.equal(m.transferOut,1000);
 assert.equal(m.net,200);assert.equal(m.adjustments,300);
 assert.equal(m.starting+m.net+m.adjustments,m.ending);
 assert.equal(m.rows.find(r=>r.name==='Repair').kind,'expense');
 assert.equal(m.rows.find(r=>r.name==='Apple Card').category,'Credit cards');
 assert.equal(m.rows.find(r=>r.name==='Upstart Loan').creditCard,false);
});
test('card classification includes joint and store cards but excludes vehicle and BNPL debt',()=>{
 assert.ok(isCard('Capital One QS - Joint'));assert.ok(isCard("Macy's Card"));assert.ok(isCard('PayPal Credit Card'));
 assert.equal(isCard('Jeep (Capital One)'),false);assert.equal(isCard('Klarna (Apple)'),false);assert.equal(isCard('Chase Loan'),false);
});
test('reports use saved effective dates and amounts without mutating calendar input',()=>{
 const f=fixture(),before=JSON.stringify(f),m=analyze(f).months[0];
 assert.equal(m.rows.find(r=>r.name==='Apple Card').date,'2026-11-01');
 assert.equal(m.rows.find(r=>r.name==='Apple Card').amount,-100);
 assert.equal(JSON.stringify(f),before);
});
test('incoming account transfers are distinct from income',()=>{
 const f=fixture();f.months[0].rows.push({date:'2026-11-01',name:'Emergency Transfer',amount:100,type:'transfer'});
 const m=analyze(f).months[0];assert.equal(m.income,2000);assert.equal(m.transferIn,100);
});
test('cash-flow what-if carries changes across months and respects the start date',()=>{
 const months=[{key:'2026-11',ending:100,rows:[{date:'2026-11-10',kind:'expense',cents:20000,creditCard:true}],days:[{date:'2026-11-10',ending:100},{date:'2026-11-27',ending:100}]},{key:'2026-12',ending:200,rows:[],days:[{date:'2026-12-27',ending:200}]}];
 const before=JSON.stringify(months),result=cashScenario(months,{start:'2026-11-01',group:'cards',reduction:50,income:100,extra:25,day:27});
 assert.equal(result[0].ending,225);assert.equal(result[1].ending,400);assert.equal(result[0].low,150);
 assert.equal(JSON.stringify(months),before);
 const later=cashScenario(months,{start:'2026-11-11',group:'cards',reduction:50,income:0,extra:0,day:27});
 assert.equal(later[0].ending,100);
});
test('cash-flow reductions cannot exceed actual scheduled expenses or reduce transfers',()=>{
 const months=[{key:'2026-11',ending:100,rows:[{date:'2026-11-10',kind:'expense',cents:1000},{date:'2026-11-10',kind:'transfer',cents:200000}],days:[{date:'2026-11-10',ending:100}]}];
 assert.equal(cashScenario(months,{start:'2026-11-01',group:'expenses',reduction:1000,income:0,extra:0,day:27})[0].ending,110);
});
test('debt payoff model conserves principal and recognizes zero APR and lump-sum payoff',()=>{
 const debts=[{name:'Card',balance:1000,apr:0,payment:100}],before=JSON.stringify(debts);
 const base=debtPlan(debts,0,0,'avalanche'),extra=debtPlan(debts,100,0,'avalanche'),lump=debtPlan(debts,0,2000,'snowball');
 assert.equal(base.months,10);assert.equal(base.interest,0);assert.equal(extra.months,5);
 assert.equal(extra.path.reduce((n,m)=>n+m.paid,0),1000);
 assert.equal(lump.months,0);assert.equal(lump.initialPayment,1000);
 assert.equal(lump.debts[0].paidMonth,0);assert.equal(JSON.stringify(debts),before);
});
test('avalanche extra payments prioritize APR and improve interest against the same budget',()=>{
 const debts=[{name:'Small',balance:500,apr:0,payment:25},{name:'Expensive',balance:2000,apr:30,payment:75}];
 const avalanche=debtPlan(debts,100,0,'avalanche'),snowball=debtPlan(debts,100,0,'snowball'),base=debtPlan(debts,0,0,'avalanche');
 assert.ok(avalanche.interest<snowball.interest);assert.ok(avalanche.interest<base.interest);
 assert.ok(avalanche.months<base.months);assert.ok(avalanche.paidOff);
});
test('payoff model reports insufficient budgets and rejects absent or invalid debt inputs',()=>{
 assert.equal(debtPlan([{name:'Card',balance:1000,apr:30,payment:1}],0,0,'avalanche').paidOff,false);
 assert.throws(()=>debtPlan([],0,0,'avalanche'),/at least one/);
 assert.throws(()=>debtPlan([{balance:100,apr:NaN,payment:10}],0,0,'avalanche'),/APR/);
});
test('CSV exports escape quoted text and neutralize formula text',()=>{
 assert.equal(csvCell('=SUM(A1)'),'"\'=SUM(A1)"');
 assert.equal(csvCell(-50),'"-50"');assert.equal(csvCell('a"b'),'"a""b"');
});
