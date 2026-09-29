'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('list-view week controls replace the grid row-control injector',()=>{
  const list=read('calendar-list-view.js'),preload=read('cache-coherence-preload.js');
  assert.match(list,/calendar-week-toggle/);
  assert.match(list,/Hide week/);
  assert.match(list,/Show week/);
  assert.match(list,/billsos-list-weeks-v1/);
  assert.doesNotMatch(preload,/updated = ensureCalendarRowControls/);
  assert.doesNotMatch(preload,/CRITICAL_ASSETS[\s\S]*calendar-row-controls-fix\.js/);
});
