'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {migratePaymentPlans}=require('../payment-plan-migration');
const {discover,register:registerCards}=require('../credit-card-manager');
const {register:registerLiabilities}=require('../liability-manager');
function fixture(){let cards={revision:3,cards:[{id:'amex',sourceBillId:'bill-a',name:'Amex Blue',paymentPlan:true,balance:900,apr:0,payment:67,balanceAsOf:'2026-11-01',history:[{date:'2026-11-01',balance:900}]},{id:'apple',sourceBillId:'bill-b',name:'Apple Card',paymentPlan:false,balance:200,payment:50}]},liabilities={revision:2,items:[{id:'hoa',name:'Dues',balance:500,payment:null,apr:0,monthlyCharge:0,firstDate:'',balanceAsOf:'2026-11-01'}]},data={bills:[{id:'bill-a',name:'Amex Blue',amount:67,dueDay:28},{id:'bill-b',name:'Apple Card',amount:50,dueDay:15}],income:[],oneTimeEvents:[]};
 const deps={readCards:()=>structuredClone(cards),readLiabilities:()=>structuredClone(liabilities),readBills:()=>structuredClone(data),writeCards:v=>{cards=v;},writeLiabilities:v=>{liabilities=v;}};
 return{deps,cards:()=>cards,liabilities:()=>liabilities,data};}
test('fixed plans move once with balances, history, and bill links intact; calendar is untouched',()=>{
 const f=fixture(),before=JSON.stringify(f.data);assert.equal(migratePaymentPlans(f.deps,'2026-11-05').added,1);
 const item=f.liabilities().items.find(i=>i.originCardId==='amex');assert.equal(item.balance,900);assert.equal(item.payment,67);assert.equal(item.apr,0);assert.equal(item.linkedBillId,'bill-a');assert.equal(item.firstDate,'2026-11-28');assert.equal(item.history.length,1);
 item.balance=700;item.removed=true;assert.equal(migratePaymentPlans(f.deps,'2026-11-05').added,0);assert.equal(f.liabilities().items.length,2);assert.equal(f.liabilities().items.find(i=>i.id===item.id).balance,700);assert.equal(f.liabilities().items.find(i=>i.id===item.id).removed,true);assert.equal(JSON.stringify(f.data),before);
});
test('unknown balances and APRs remain unknown; failed source writes retry without duplicate liabilities',()=>{
 const f=fixture();f.cards().cards[0].balance=null;f.cards().cards[0].apr=null;const original=f.deps.writeCards;f.deps.writeCards=()=>{throw Error('temporary disk failure');};
 assert.throws(()=>migratePaymentPlans(f.deps,'2026-11-05'));assert.equal(f.cards().paymentPlansSeparated,undefined);assert.equal(f.liabilities().items.length,2);
 f.deps.writeCards=original;migratePaymentPlans(f.deps,'2026-11-05');assert.equal(f.liabilities().items.length,2);assert.equal(f.liabilities().items[1].balance,null);assert.equal(f.liabilities().items[1].apr,null);
});
test('issuer names do not automatically classify newly added cards as payment plans',()=>{
 const rows=discover({bills:[{id:'new',name:'Amex New Card',amount:50,dueDay:15}]},{cards:[],paymentPlansSeparated:true},'2026-11-05');assert.equal(rows[0].paymentPlan,false);
});
test('destination failures leave the source tracker untouched',()=>{
 const f=fixture(),before=JSON.stringify(f.cards());let sourceWrites=0;f.deps.writeCards=()=>{sourceWrites++;};f.deps.writeLiabilities=()=>{throw Error('destination unavailable');};
 assert.throws(()=>migratePaymentPlans(f.deps,'2026-11-05'));assert.equal(sourceWrites,0);assert.equal(JSON.stringify(f.cards()),before);
});
function harness(register,store,data){const routes={};let writes=0;register({get:(p,f)=>routes['GET '+p]=f,post:(p,f)=>routes['POST '+p]=f},{readStore:()=>structuredClone(store),writeStore:v=>{store=v;},readBills:()=>structuredClone(data),writeBills:()=>{writes++;}});return{call(method,path,body){const r={statusCode:200,status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},setHeader(){}};routes[method+' '+path]({body},r);return r;},store:()=>store,writes:()=>writes};}
test('removed cards stay removed after discovery and can be restored with history',()=>{
 const f=fixture();f.cards().cards=f.cards().cards.filter(c=>c.id==='apple');const h=harness(registerCards,f.cards(),f.data),before=JSON.stringify(f.data);
 let r=h.call('POST','/api/credit-cards/remove',{id:'apple',revision:3});assert.equal(r.statusCode,200);assert.equal(r.body.cards.some(c=>c.id==='apple'),false);assert.equal(r.body.removed[0].name,'Apple Card');
 assert.equal(h.call('GET','/api/credit-cards').body.cards.some(c=>c.id==='apple'),false);
 assert.equal(h.call('POST','/api/credit-cards/remove',{id:'apple',revision:3}).statusCode,409);
 r=h.call('POST','/api/credit-cards/restore',{id:'apple',revision:4});assert.equal(r.body.cards.find(c=>c.id==='apple').balance,200);assert.equal(h.writes(),0);assert.equal(JSON.stringify(f.data),before);
});
test('fixed plans disappear from Credit Cards; liabilities can be removed and restored independently',()=>{
 const f=fixture();migratePaymentPlans(f.deps,'2026-11-05');const cards=harness(registerCards,f.cards(),f.data);assert.equal(cards.call('GET','/api/credit-cards').body.cards.some(c=>c.id==='amex'),false);
 const h=harness(registerLiabilities,f.liabilities(),f.data),item=f.liabilities().items.find(i=>i.originCardId==='amex');let r=h.call('POST','/api/liabilities/remove',{id:item.id,revision:3});assert.equal(r.body.items.some(i=>i.id===item.id),false);assert.equal(r.body.removed[0].id,item.id);
 r=h.call('POST','/api/liabilities/restore',{id:item.id,revision:4});assert.equal(r.body.items.find(i=>i.id===item.id).balance,900);assert.equal(h.writes(),0);
});
