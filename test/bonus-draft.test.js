'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {register}=require('../credit-card-manager');
test('last-used draft retains unfinished values and allocations without changing the calendar',()=>{
 let tracker={cards:[],revision:0},calendarWrites=0;const routes=new Map();
 register({get(){},post(path,fn){routes.set(path,fn);}}, {readStore:()=>structuredClone(tracker),writeStore:s=>tracker=s,readBills:()=>({bills:[],income:[],oneTimeEvents:[]}),writeBills:()=>calendarWrites++});
 const input={start:'',buffer:'',includeLmcc:false,alreadyScheduled:true,sandbox:{gross:'12345',net:'',netMode:'estimate',withholding:'',reno:'15000',reserve:'',cushion:'0'},allocations:{card:'123.45'}};
 function save(revision,input){const res={code:200,status(c){this.code=c;return this;},json(v){this.value=v;}};routes.get('/api/credit-cards/bonus-draft')({body:{revision,input}},res);return res;}
 assert.equal(save(0,input).code,200);
 assert.deepEqual(tracker.bonusDraft.sandbox,input.sandbox);
 assert.deepEqual(tracker.bonusDraft.allocations,input.allocations);
 assert.equal(tracker.bonusDraft.start,'');assert.equal(tracker.bonusDraft.includeLmcc,false);
 assert.ok(Date.parse(tracker.bonusDraft.updatedAt));assert.equal(calendarWrites,0);
 assert.equal(save(0,input).code,409);
 assert.equal(save(1,{...input,sandbox:{net:'Infinity'}}).code,400);
 assert.equal(tracker.revision,1);
});
