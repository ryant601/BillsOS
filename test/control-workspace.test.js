'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {matches,sortRecords}=require('../control-workspace');
const html=fs.readFileSync(path.join(__dirname,'../control.html'),'utf8');
test('search combines words with payment and status filters without changing records',()=>{
 const row={name:'Electric',text:'Electric Utilities winter adjustment',payment:'auto',status:'active'},before=JSON.stringify(row);
 assert.equal(matches(row,{search:'ELECTRIC winter',payment:'auto',status:'active'}),true);
 assert.equal(matches(row,{search:'electric missing'}),false);assert.equal(matches(row,{status:'paused'}),false);assert.equal(matches(row,{payment:'manual'}),false);assert.equal(JSON.stringify(row),before);
});
test('sorting supports numeric due days, real dates, and descending amounts without changing source order',()=>{
 const rows=[{name:'B',date:20,amount:100},{name:'A',date:3,amount:200}];
 assert.equal(sortRecords(rows,'date')[0].name,'A');assert.equal(sortRecords(rows,'amount')[0].name,'A');assert.equal(rows[0].name,'B');
 assert.equal(sortRecords([{name:'Later',date:'2027-01-01'},{name:'Earlier',date:'2026-12-31'}],'date')[0].name,'Earlier');
});
test('recurring income saves immediately and preserves form entries when saving fails',async()=>{
 const source=html.slice(html.indexOf('async function saveIncomeFromForm()'),html.indexOf('\n',html.indexOf('async function saveIncomeFromForm()')));
 const values={incomeId:'salary',incomeName:'Salary',incomeAmount:'2000',incomeSchedule:'monthly',incomeStartDate:'2026-11-15',incomeActive:'true',incomeNotes:'Edited'};
 const nodes=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]));let cleared=0,calls=0;
 const context={incomeSaving:false,state:{income:[{id:'salary',name:'Old',customFlag:'keep'}]},document:{getElementById:id=>nodes[id]},uid:()=>'',structuredClone,renderAll(){},clearIncomeForm(){cleared++;},setStatus(){},persistState:async(_msg,previous)=>{calls++;assert.equal(previous.income[0].name,'Old');return false;}};
 vm.createContext(context);vm.runInContext(source,context);await context.saveIncomeFromForm();assert.equal(calls,1);assert.equal(cleared,0);assert.equal(context.state.income[0].customFlag,'keep');assert.equal(nodes.incomeName.value,'Salary');
 context.persistState=async()=>true;await context.saveIncomeFromForm();assert.equal(cleared,1);
});
test('one-time income is not duplicated in the one-time expense list',()=>{
 const source=html.slice(html.indexOf('function renderOne()'),html.indexOf('\n',html.indexOf('function renderOne()')));
 const nodes={oneCount:{},oneTable:{}};
 const context={state:{oneTimeEvents:[{id:'expense',name:'Repair',amount:-100,type:'adjustment'},{id:'income',name:'Bonus',amount:200,type:'income'}]},highlightedOneTimeId:'',document:{getElementById:id=>nodes[id]},esc:String,money:String,normalizedSignedAmount:r=>r.amount,adjustmentDirection:()=>({className:'outflow'})};
 vm.createContext(context);vm.runInContext(source,context);context.renderOne();assert.match(nodes.oneTable.innerHTML,/Repair/);assert.doesNotMatch(nodes.oneTable.innerHTML,/Bonus/);assert.equal(nodes.oneCount.textContent,'1 item');
});

test('funding view includes recurring and one-time transfers with calendar edits', () => {
 const engine = require('../cashflow-engine');
 const { fundingRows } = require('../control-workspace');
 const data = {
   bills: [{id:'monthly',name:'Spending Account Funding',amount:1000,dueDay:8,startMonth:'2027-03',endMonth:'2027-03'}],
   oneTimeEvents: [
     {id:'transfer',name:'Fund Spending Account',amount:-2250,date:'2027-03-19',type:'transfer'},
     {id:'other',name:'Savings transfer',amount:-400,date:'2027-03-19',type:'transfer'}
   ], income:[]
 };
 const key = '2027-03-19|Fund Spending Account|-2250';
 const rows = fundingRows(engine, data, {
   dateAdjustments:{[key]:{date:'2027-04-02'}}, amountAdjustments:{[key]:{amount:2000}}
 });
 assert.deepEqual(rows.map(row => [row.date,row.amount]), [['2027-03-08',1000],['2027-04-02',2000]]);
 assert.equal(rows[1].key,key);
});
