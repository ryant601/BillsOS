'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validate,amortize,paymentDate,preview,register}=require('../liability-manager');
const base={id:'hoa',name:'Neighborhood dues',category:'HOA',balance:1000,payment:300,monthlyCharge:0,apr:0,balanceAsOf:'2026-11-01',firstDate:'2026-11-30',history:[],linkedBillId:''};
function data(){return {bills:[],income:[],paymentSplits:[],oneTimeEvents:[{id:'opening',name:'Opening balance',type:'balance-opening-adjustment',date:'2026-06-01',amount:5000}]};}
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
 assert.throws(()=>validate({...base,payment:0},base,'2026-11-05'));
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
 register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{readStore:()=>structuredClone(s),writeStore:v=>{s=v;},readBills:()=>structuredClone(d),writeBills:v=>{d=v;writes++;}});
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
 register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{readStore:()=>s,writeStore:()=>{},readBills:()=>structuredClone(d),writeBills:()=>{writes++;}});
 const input={itemId:base.id,months:2,buffer:150,revision:1},p=preview(d,base,input,'2026-11-05');
 d.oneTimeEvents.push({id:'new',name:'New expense',date:'2027-01-01',amount:-4900,type:'adjustment'});
 const r={statusCode:200,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}};routes['POST /api/liabilities/payments']({body:{...input,fingerprint:p.fingerprint}},r);
 assert.equal(r.statusCode,409);assert.equal(writes,0);
});
