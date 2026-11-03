'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {makeRow,save}=require('../quick-transaction');
const input={name:'Repair',kind:'expense',amount:'123.45',date:'2026-11-03',notes:'  Test note  '};
test('quick transaction signs income and expenses correctly and validates real dates',()=>{
 const row=makeRow(input,'quick-test','2026-06-01','2027-12-31');
 assert.equal(row.amount,-123.45);assert.equal(row.type,'adjustment');assert.equal(row.notes,'Test note');
 assert.equal(makeRow({...input,kind:'income'},'id','2026-06-01','2027-12-31').amount,123.45);
 for(const change of [{amount:'0'},{amount:'-1'},{amount:'1.001'},{date:'2026-02-30'},{date:'2028-01-01'},{name:' '}]){
 assert.throws(()=>makeRow({...input,...change},'id','2026-06-01','2027-12-31'));
 }
});
test('quick save retries a conflict using newer rows and preserves all calendar metadata',async()=>{
 const row=makeRow(input,'quick-test','2026-06-01','2027-12-31');
 const initial={updatedAt:'old',oneTimeEvents:[{id:'existing'}],bills:[{id:'bill'}],income:[{id:'income'}],paymentSplits:[{id:'split'}]};
 const latest={...initial,updatedAt:'new',oneTimeEvents:[{id:'existing'},{id:'newer'},{id:'__billsos_system_rules__',notes:'metadata'}]};
 const calls=[];let posts=0;
 const fetcher=async(url,options)=>{calls.push({url,options});if(!options.method)return{ok:true,json:async()=>initial};posts++;return posts===1?{ok:false,status:409,json:async()=>({current:latest})}:{ok:true,json:async()=>JSON.parse(options.body)}};
 const saved=await save(fetcher,row);
 assert.deepEqual(saved.oneTimeEvents.map(x=>x.id),['existing','newer','__billsos_system_rules__','quick-test']);
 assert.deepEqual(saved.bills,latest.bills);assert.deepEqual(saved.income,latest.income);assert.deepEqual(saved.paymentSplits,latest.paymentSplits);
 assert.equal(saved.updatedAt,'new');assert.equal(posts,2);
});
test('retry after a successful but interrupted save does not duplicate the transaction',async()=>{
 const row=makeRow(input,'quick-test','2026-06-01','2027-12-31');let calls=0;
 const current={oneTimeEvents:[row]};
 const result=await save(async()=>{calls++;return{ok:true,json:async()=>current}},row);
 assert.equal(calls,1);assert.equal(result.oneTimeEvents.length,1);
});
test('failed save is reported to keep the form available for retry',async()=>{
 await assert.rejects(save(async()=>({ok:false}),{}),/latest calendar/);
});
