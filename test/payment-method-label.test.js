'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../cashflow-engine'),quick=require('../quick-transaction');
const html=fs.readFileSync(require('node:path').join(__dirname,'../generated-v5.html'),'utf8');
const source=html.slice(html.indexOf('function paymentMethodLabel('),html.indexOf('\n',html.indexOf('function paymentMethodLabel(')));
const context={Number,String};vm.createContext(context);vm.runInContext(source,context);
test('recurring and one-time payment methods reach calendar rows without changing cash flow',()=>{
 const data={bills:[{id:'bill',name:'Bill',amount:20,dueDay:3,payMethod:'auto'}],income:[],oneTimeEvents:[{id:'one',name:'Repair',date:'2026-11-03',amount:-30,type:'adjustment',payMethod:'manual'}]};
 const model=engine.build(data,{}),rows=model.months.november.rows;
 assert.equal(rows.find(r=>r.sourceId==='bill').payMethod,'auto');
 assert.equal(rows.find(r=>r.sourceId==='one').payMethod,'manual');
 assert.equal(rows.reduce((n,r)=>n+r.amount,0),-50);
 assert.equal(context.paymentMethodLabel(rows[0]),'Auto pay');
 assert.equal(context.paymentMethodLabel(rows[1]),'Manual');
});
test('missing methods stay unknown and income or balance adjustments have no payment label',()=>{
 assert.equal(context.paymentMethodLabel({name:'Repair',amount:-20,type:'adjustment'}),'Not set');
 assert.equal(context.paymentMethodLabel({name:'Bill',amount:-20,type:'manual'}),'Manual');
 assert.equal(context.paymentMethodLabel({name:'Refund',amount:20,payMethod:'auto'}),'');
 assert.equal(context.paymentMethodLabel({name:'Balance correction',amount:-20,type:'adjustment'}),'');
 assert.equal(context.paymentMethodLabel({name:'Fund Spending Account',amount:-2000,type:'transfer'}),'');
});
test('quick expenses save the selected method and income does not inherit an expense method',()=>{
 const input={name:'Repair',amount:20,date:'2026-11-03',kind:'expense',payMethod:'auto'};
 assert.equal(quick.makeRow(input,'one','2026-06-01','2027-12-31').payMethod,'auto');
 assert.equal(quick.makeRow({...input,kind:'income'},'two','2026-06-01','2027-12-31').payMethod,'');
});
