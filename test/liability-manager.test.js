'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate,amortize,paymentDate,preview,register}=require('../liability-manager');
const base={id:'hoa',name:'Neighborhood dues',category:'HOA',balance:1000,payment:300,monthlyCharge:0,apr:0,balanceAsOf:'2026-11-01',firstDate:'2026-11-30',history:[],linkedBillId:''};
function data(){return {bills:[],income:[],paymentSplits:[],oneTimeEvents:[{id:'opening',name:'Opening balance',type:'balance-opening-adjustment',date:'2026-06-01',amount:5000}]};}
test('liabilities can be saved without any monthly payment or fixed start date',()=>{
 const item=validate({...base,payment:'',firstDate:''},base,'2026-11-05');assert.equal(item.payment,null);assert.equal(item.firstDate,'');assert.equal(amortize(item).needsSchedule,true);
});
test('calendar room sets variable payments and protects out-month lows',()=>{
 const d=data();d.oneTimeEvents.push({id:'nov',name:'November expense',date:'2026-11-10',amount:-3900,type:'adjustment'},{id:'dec',name:'December income',date:'2026-12-01',amount:1000,type:'income'},{id:'jan',name:'January expense',date:'2027-01-20',amount:-500,type:'adjustment'});
 const item={...base,payment:null,firstDate:''},p=preview(d,item,{mode:'calendar',start:'2026-11-05',end:'2026-12-31',buffer:950,strategy:'early'},'2026-11-05');
 assert.deepEqual(p.payments.map(p=>[p.date,p.amount]),[['2026-11-05',150],['2026-12-01',500]]);assert.equal(p.total,650);assert.equal(p.lowest,950);assert.equal(p.remainingRecorded,350);assert.equal(p.debtRows.at(-1).ending,350);
});
test('calendar strategies are driven by cash room rather than the optional fixed budget',()=>{
 const input={mode:'calendar',start:'2026-11-05',end:'2026-12-31',buffer:950};
 const early=preview(data(),{...base,payment:10},{...input,strategy:'early'},'2026-11-05'),spread=preview(data(),{...base,payment:10},{...input,strategy:'spread'},'2026-11-05');
 assert.equal(early.total,1000);assert.equal(early.payments.length,1);assert.deepEqual(spread.payments.map(p=>p.amount),[500,500]);
});
test('future scheduled payments reserve the liability balance and low cash produces no proposal',()=>{
 const d=data();d.oneTimeEvents.push({id:'already',liabilityId:base.id,name:base.name,date:'2026-12-01',amount:-1000,type:'adjustment'});
 const input={mode:'calendar',start:'2026-11-05',end:'2026-12-31',buffer:950};assert.equal(preview(d,base,input,'2026-11-05').payments.length,0);
 const tight=data();tight.oneTimeEvents.push({id:'low',name:'Future bill',date:'2027-01-01',amount:-4900,type:'adjustment'});
 assert.equal(preview(tight,base,input,'2026-11-05').payments.length,0);
});
test('a calendar-driven proposal can be accepted once without creating a monthly budget',()=>{
 const routes={};let d=data(),writes=0;const s={revision:1,items:[{...base,payment:null,firstDate:''}]};
 register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{currentDate:()=>"2026-11-05",readStore:()=>structuredClone(s),writeStore:()=>{},readBills:()=>structuredClone(d),writeBills:v=>{d=v;writes++;}});
 function call(path,body){const r={statusCode:200,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};routes['POST '+path]({body},r);return r;}
 const input={itemId:base.id,revision:1,mode:'calendar',start:'2026-11-05',end:'2026-12-31',buffer:950,strategy:'spread'},p=call('/api/liabilities/preview',input).body;
 assert.equal(call('/api/liabilities/payments',{...input,fingerprint:p.fingerprint}).body.saved,2);assert.equal(writes,1);assert.equal(s.items[0].payment,null);assert.equal(s.items[0].balance,1000);
 assert.equal(call('/api/liabilities/payments',{...input,fingerprint:p.fingerprint}).body.saved,0);assert.equal(writes,1);
});
test('amortization caps the final payment and preserves month-end dates',()=>{
 const a=amortize(base);assert.equal(a.months,4);assert.equal(a.rows.at(-1).payment,100);assert.equal(a.rows.at(-1).ending,0);assert.equal(a.rows.at(-1).date,'2027-02-28');
 assert.equal(paymentDate('2026-12-31',2),'2027-02-28');assert.equal(paymentDate('2026-12-31',3),'2027-03-31');
});
test('new dues are separate from arrears and ordinary dues continue after catching up',()=>{
 const a=amortize({...base,payment:440,monthlyCharge:240});assert.equal(a.months,5);assert.equal(a.rows[0].ending,800);assert.equal(a.rows[5].payment,240);assert.equal(a.rows[5].ending,0);assert.ok(a.rows.length>=24);
 const growing=amortize({...base,payment:100,monthlyCharge:240});assert.equal(growing.cleared,false);assert.equal(growing.months,null);assert.ok(growing.remaining>base.balance);
});
test('interest is modeled explicitly and validation rejects invalid dates and terms',()=>{
 assert.equal(amortize({...base,apr:12}).rows[0].interest,10);
 assert.equal(validate({...base,payment:'',firstDate:''},base,'2026-11-05').payment,null);
 assert.throws(()=>validate({...base,firstDate:'2026-11-31'},base,'2026-11-05'));
 const saved=validate({...base,balance:900,balanceAsOf:'2026-11-05'},base,'2026-11-05');assert.equal(saved.history.at(-1).balance,900);
});
test('calendar preview checks later months and refuses an already linked bill',()=>{
 const d=data();d.oneTimeEvents.push({id:'large',name:'Later expense',date:'2027-01-15',amount:-4300,type:'adjustment'});
 const p=preview(d,base,{months:3,buffer:0},'2026-11-05');assert.equal(p.safe,false);assert.equal(p.lowest,-200);assert.equal(p.lowestDate,'2027-01-30');
 assert.throws(()=>preview(d,{...base,linkedBillId:'existing'},{months:3,buffer:0},'2026-11-05'));
 d.bills.push({id:'existing',name:base.name,amount:300});assert.throws(()=>preview(d,base,{months:3,buffer:0},'2026-11-05'));
});
test('saving a liability does not schedule anything; calendar commit is reviewed and idempotent',()=>{
 const routes={};let s={revision:0,items:[]},d=data(),writes=0;
 register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{currentDate:()=>"2026-11-05",readStore:()=>structuredClone(s),writeStore:v=>{s=v;},readBills:()=>structuredClone(d),writeBills:v=>{d=v;writes++;}});
 function call(path,body){const r={statusCode:200,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},setHeader(){}};routes['POST '+path]({body},r);return r;}
 const saved=call('/api/liabilities',{revision:0,item:{...base,id:undefined}});assert.equal(saved.statusCode,200);assert.equal(writes,0);assert.equal(d.oneTimeEvents.length,1);
 const itemId=s.items[0].id,input={itemId,months:2,buffer:150,revision:s.revision},p=call('/api/liabilities/preview',input).body;
 assert.equal(p.payments.length,2);assert.equal(call('/api/liabilities/payments',{...input,fingerprint:'stale'}).statusCode,409);
 assert.equal(call('/api/liabilities/payments',{...input,fingerprint:p.fingerprint}).body.saved,2);assert.equal(writes,1);assert.equal(s.items[0].balance,1000);
 assert.equal(call('/api/liabilities/payments',{...input,fingerprint:p.fingerprint}).body.saved,0);assert.equal(writes,1);
 assert.equal(call('/api/liabilities',{revision:0,item:{...base,id:itemId}}).statusCode,409);
});
test('commit rechecks cash flow after another calendar change',()=>{
 const routes={};let d=data(),writes=0;const s={revision:1,items:[base]};
 register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{currentDate:()=>"2026-11-05",readStore:()=>s,writeStore:()=>{},readBills:()=>structuredClone(d),writeBills:()=>{writes++;}});
 const input={itemId:base.id,months:2,buffer:150,revision:1},p=preview(d,base,input,'2026-11-05');
 d.oneTimeEvents.push({id:'new',name:'New expense',date:'2027-01-01',amount:-4900,type:'adjustment'});
 const r={statusCode:200,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};routes['POST /api/liabilities/payments']({body:{...input,fingerprint:p.fingerprint}},r);
 assert.equal(r.statusCode,409);assert.equal(writes,0);
});
