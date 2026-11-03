'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { projection, discover, validateCard, quote, register } = require('../credit-card-manager');
function fixture() { return { bills: [], income: [], oneTimeEvents: [{id:'opening',name:'Opening balance',type:'balance-opening-adjustment',date:'2026-06-01',amount:5000,requestedBalance:5000}], paymentSplits:[] }; }
const card = {id:'card',name:'Apple Card',balance:2000,payment:100,apr:20,history:[]};
test('discovery preserves entered balances and does not infer balances from bill payments',()=>{
 const data=fixture();data.bills=[{id:'apple',name:'Apple Card',amount:100},{id:'jeep',name:'Jeep (Capital One)',amount:1200}];
 const first=discover(data,{cards:[]});assert.equal(first.length,1);assert.equal(first[0].balance,null);
 const saved={...first[0],balance:900,apr:25};data.bills[0].amount=200;
 assert.equal(discover(data,{cards:[saved]})[0].balance,900);
});
test('manual balance updates append history, preserve source identity, and support zero APR',()=>{
 const updated=validateCard({...card,balance:1800,balanceAsOf:'2026-11-03',apr:0},{...card,sourceBillId:'apple'},'2026-11-03');
 assert.equal(updated.history.length,1);assert.equal(updated.history[0].balance,1800);assert.equal(updated.sourceBillId,'apple');assert.equal(updated.apr,0);
 assert.throws(()=>validateCard({...card,balance:-1},card));assert.throws(()=>validateCard({...card,apr:101},card));
 assert.throws(()=>validateCard({...card,balanceAsOf:'2027-01-01'},card,'2026-11-03'));
});
test('a replacement schedule is one card and retains saved balances across month changes',()=>{
 const data=fixture();data.bills=[{id:'old',name:'Amex Blue',amount:100.67,startMonth:'2026-09',endMonth:'2026-10'},{id:'new',name:'Amex Blue',amount:67,startMonth:'2026-11'}];
 const fresh=discover(data,{cards:[]},'2026-11-03');assert.equal(fresh.length,1);assert.equal(fresh[0].payment,67);
 const existing={...card,id:'cc-old',sourceBillId:'old',name:'Amex Blue',balance:1200};
 const saved=discover(data,{cards:[existing]},'2026-11-03');assert.equal(saved.length,1);assert.equal(saved[0].balance,1200);assert.equal(saved[0].sourceBillId,'new');assert.equal(saved[0].id,'cc-old');
});
test('projection applies cross-month moves and amount edits before carrying balances',()=>{
 const data=fixture();data.oneTimeEvents.push({id:'expense',name:'Repair',date:'2026-10-02',amount:-100,type:'adjustment'});
 data.oneTimeEvents.push({id:'__billsos_system_rules__',notes:JSON.stringify({calendarState:{dateAdjustments:{'2026-10-02|Repair|-100':{date:'2026-09-30'}},amountAdjustments:{'2026-10-02|Repair|-100':{amount:150}}}})});
 const days=projection(data);assert.equal(days.find(d=>d.date==='2026-09-30').ending,4850);assert.equal(days.find(d=>d.date==='2026-10-02').ending,4850);
 const extra=projection(data,{date:'2026-11-05',amount:200});assert.equal(extra.at(-1).ending,4650);assert.equal(extra.find(d=>d.date==='2026-11-04').ending,4850);
});
test('payment checks future low days instead of only payment day and accepts explicit zero buffer',()=>{
 const data=fixture();data.oneTimeEvents.push({id:'later',name:'Later expense',date:'2027-01-15',amount:-4500,type:'adjustment'});
 const input={amount:600,buffer:0,start:'2026-11-03',end:'2026-11-04'};
 assert.equal(quote(data,card,input,'2026-11-03').safe,false);
 const result=quote(data,card,{...input,amount:500},'2026-11-03');assert.equal(result.safe,true);assert.equal(result.options[0].lowest,0);assert.equal(result.options[0].lowestDate,'2027-01-15');
 assert.throws(()=>quote(data,card,{...input,amount:3000},'2026-11-03'));
});
test('commit rechecks latest cash flow, saves once, preserves calendar, and rejects stale card edits',()=>{
 const routes={};const app={get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f};
 let data=fixture(),store={revision:1,cards:[card]},writes=0;
 register(app,{readStore:()=>structuredClone(store),writeStore:s=>{store=s;},readBills:()=>structuredClone(data),writeBills:d=>{data=d;writes++;return d;}});
 function call(path,body){const response={statusCode:200,status(s){this.statusCode=s;return this;},json(v){this.body=v;return this;}};routes['POST '+path]({body},response);return response;}
 const payload={cardId:'card',date:'2026-11-05',amount:200,buffer:950,planId:'abcdefghijklmnop123'};
 assert.equal(call('/api/credit-cards/payments',payload).body.saved,true);assert.equal(data.oneTimeEvents.length,2);assert.equal(data.oneTimeEvents[1].amount,-200);
 assert.equal(call('/api/credit-cards/payments',payload).body.duplicate,true);assert.equal(writes,1);assert.equal(store.cards[0].balance,2000);
 data.oneTimeEvents.push({id:'danger',date:'2027-01-10',name:'Danger',amount:-4500,type:'adjustment'});
 assert.equal(call('/api/credit-cards/payments',{...payload,planId:'abcdefghijklmnop456'}).statusCode,409);
 assert.equal(call('/api/credit-cards',{revision:0,card}).statusCode,409);
});
