'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('dashboard keeps recommendation preferences before removing metadata from payment rows',async()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../generated-v5.html'),'utf8');
 const source=html.slice(html.indexOf('async function loadBillsData()'),html.indexOf('\n',html.indexOf('async function loadBillsData()')));
 const prefs={proposal:{label:'Card',updatedAt:'2026-10-29T20:00:00Z'}};
 const data={bills:[],income:[],oneTimeEvents:[{id:'__billsos_system_rules__',amount:0,notes:JSON.stringify({calendarState:{recommendationPreferences:prefs}})},{id:'payment',amount:100}]};
 const context={fetch:async()=>({ok:true,json:async()=>data}),Date,JSON,Number,Array};vm.createContext(context);vm.runInContext(source,context);
 const loaded=await context.loadBillsData();
 assert.equal(loaded.recommendationPreferences.proposal.label,'Card');
 assert.deepEqual(loaded.oneTimeEvents.map(row=>row.id),['payment']);
});
