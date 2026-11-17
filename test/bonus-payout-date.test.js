'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {debtScenarios}=require('../credit-card-manager');
test('March 10 bonus allocations use March 10 estimated balances after intervening payments and interest',()=>{
 const data={bills:[{id:'card',name:'Citi Demo',amount:100,dueDay:5,startMonth:'2027-03'}],income:[],oneTimeEvents:[{id:'opening',name:'Opening',date:'2026-06-01',type:'balance-opening-adjustment',amount:5000,requestedBalance:5000}]};
 const cards=[{id:'c',sourceBillId:'card',name:'Citi Demo',balance:1000,apr:36.5,balanceAsOf:'2027-03-01',paymentPlan:false}];
 const common={months:1,extra:0,lump:2000,buffer:0,bonus:2000};
 const early=debtScenarios(data,cards,{...common,start:'2027-03-01'}, {},'2027-03-01');
 const payout=debtScenarios(data,cards,{...common,start:'2027-03-10'}, {},'2027-03-01');
 let expected=1000;
 for(let day=2;day<=10;day++){expected*=1.001;if(day===5)expected-=100;}
 const balance=Math.ceil(expected*100)/100;
 assert.equal(early.scenarios[0].atDeployment[0].balance,1000);
 assert.equal(payout.scenarios[0].atDeployment[0].balance,balance);
 const plan=payout.scenarios.find(p=>p.strategy==='avalanche');
 assert.equal(plan.payments[0].date,'2027-03-10');
 assert.equal(plan.payments[0].amount,balance);
});
