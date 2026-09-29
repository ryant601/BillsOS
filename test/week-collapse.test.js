'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const list=require('../calendar-list-view.js');

test('September is grouped into real Sunday through Saturday week ranges',()=>{
  const weeks=list.buildMonth([],2026,9,1000,{}).weeks;
  assert.deepEqual(weeks.map(week=>[week.startDate,week.endDate]),[
    ['2026-09-01','2026-09-05'],['2026-09-06','2026-09-12'],['2026-09-13','2026-09-19'],['2026-09-20','2026-09-26'],['2026-09-27','2026-09-30']
  ]);
});

test('week summaries preserve risk line of sight when their body is hidden',()=>{
  const weeks=list.buildMonth([{day:7,amount:-1200}],2026,9,500,{}).weeks;
  const risk=weeks.find(week=>week.negativeDays>0);
  assert.equal(risk.defaultExpanded,true);
  assert.equal(risk.lowestBalance,-700);
  assert.equal(risk.lowestDate,'2026-09-07');
  assert.equal(list.STORAGE_KEY,'billsos-list-weeks-v1');
});
