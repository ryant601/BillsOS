'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {accept,register}=require('../calendar-suggestion-manager');
const {projection}=require('../credit-card-manager');
const suggestions=require('../negative-balance-recommendations');
const date='2026-11-01';
function fixture(name='Flexible bill') {return {bills:[{id:'bill',name,amount:600,dueDay:3,frequency:'monthly',startMonth:'2026-11',active:true}],income:[],oneTimeEvents:[{id:'opening',name:'Opening funds',date,amount:300,type:'income'},{id:'pay',name:'Paycheck',date:'2026-11-06',amount:900,type:'income'}]};}
function choices(data,ahead=false){const days=projection(data),rows=days.flatMap(d=>d.items);return ahead?suggestions.recommendAhead(rows,days,date,120,300):suggestions.recommend(rows,{days:days.filter(d=>d.date.startsWith('2026-11'))},date,300);}
function payments(data,month='2026-11'){return projection(data).filter(d=>d.date.startsWith(month)).flatMap(d=>d.items).filter(r=>r.amount<0);}
test('accepting a move changes one occurrence and recalculates the previewed daily balances',()=>{
 const d=fixture(),before=JSON.stringify(d),choice=choices(d).find(c=>c.kind==='move'),r=accept(d,{choice},date);
 assert.equal(JSON.stringify(d),before);assert.deepEqual(payments(r.data).map(r=>[r.iso,r.amount]),[['2026-11-06',-600]]);
 assert.deepEqual(payments(r.data,'2026-12').map(r=>[r.iso,r.amount]),[['2026-12-03',-600]]);
 assert.equal(Math.min(...projection(r.data).filter(d=>d.date.startsWith('2026-11')).map(d=>d.ending)),choice.lowestAfter);
 assert.throws(()=>accept(r.data,{choice},date),/changed/);
});
test('accepting a partial shift preserves exact cents and the original payment total',()=>{
 const d=fixture(),choice=choices(d).find(c=>c.kind==='split'),r=accept(d,{choice},date);
 assert.deepEqual(payments(r.data).map(r=>[r.iso,r.amount]),[['2026-11-03',-300],['2026-11-06',-300]]);
 assert.equal(payments(r.data).reduce((n,r)=>n+r.amount,0),-600);
 assert.throws(()=>accept(r.data,{choice},date),/changed/);
});
test('forward mortgage splits apply both displayed dates and amounts',()=>{
 const d=fixture('Mortgage'),choice=choices(d,true)[0];assert.ok(choice);
 const r=accept(d,{choice},date);assert.deepEqual(payments(r.data).map(r=>[r.iso,r.amount]),[[choice.firstDate,-choice.firstAmount],[choice.secondDate,-choice.secondAmount]]);
 assert.ok(payments(r.data).every(r=>r.iso<='2026-11-17'));
});
test('existing overrides and unrelated edits are retained; adjusted payments can be accepted',()=>{
 const {applyCalendarStatePatch}=require('../bills-data-integrity');
 const raw=fixture(),d=applyCalendarStatePatch(raw,{baseRevision:-1,calendarState:{dateAdjustments:{'2026-11-03|Flexible bill|-600':{date:'2026-11-04',originalDate:'2026-11-03',updatedAt:'2026-10-31T00:00:00Z'}},notesAdjustments:{unrelated:{note:'keep',updatedAt:'2026-10-31T00:00:00Z'}}}});
 const choice=choices(d)[0];assert.equal(choice.from,'2026-11-04');const r=accept(d,{choice},date);
 assert.deepEqual(payments(r.data).map(r=>[r.iso,r.amount]),[['2026-11-06',-600]]);
 const rules=JSON.parse(r.data.oneTimeEvents.find(e=>e.id==='__billsos_system_rules__').notes);assert.equal(rules.calendarState.notesAdjustments.unrelated.note,'keep');
});
test('stale, modified, skipped, paid, and excluded suggestions cannot change the calendar',()=>{
 const d=fixture(),choice=choices(d)[0];
 assert.throws(()=>accept(d,{choice:{...choice,amount:999}},date),/changed/);
 assert.throws(()=>accept(d,{choice},date,{'2026-11-03|Flexible bill|-600':true}),/marked paid/);
 const stale=structuredClone(d);stale.bills[0].amount=601;assert.throws(()=>accept(stale,{choice},date),/changed/);
 const skipped=structuredClone(d);skipped.oneTimeEvents.push({id:'__billsos_system_rules__',notes:JSON.stringify({calendarState:{recommendationPreferences:{[suggestions.suggestionKey(choice)]:{deleted:false}}}})});assert.throws(()=>accept(skipped,{choice},date),/changed/);
 assert.throws(()=>accept(fixture('Fund Spending Account'),{choice:{...choice,name:'Fund Spending Account'}},date),/changed/);
});
test('endpoint commits once and rejects a repeated acceptance without another write',()=>{
 let d=fixture(),writes=0;const routes={};register({post:(p,f)=>routes[p]=f},{readBills:()=>d,writeBills:v=>{d=v;writes++;},currentDate:()=>date});
 const choice=choices(d)[0];function call(){const res={status(v){this.code=v;return this;},json(v){this.body=v;return this;}};routes['/api/bills/accept-suggestion']({body:{choice}},res);return res;}
 assert.equal(call().body.saved,true);assert.equal(writes,1);assert.equal(call().code,409);assert.equal(writes,1);
});
test('calendar scripts parse and suggestion controls expose an owner-only accept action',()=>{
 const html=fs.readFileSync(require.resolve('../generated-v5.html'),'utf8');
 for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
 assert.match(html,/data-accept-suggestion/);assert.match(html,/role!=='viewer'/);assert.match(html,/\/api\/bills\/accept-suggestion/);
});
