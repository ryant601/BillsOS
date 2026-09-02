'use strict';

const fs=require('fs');
const path=require('path');
const test=require('node:test');
const assert=require('node:assert/strict');

function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8')}

test('calendar row controls remain available for current and future rows without widening day cells',()=>{
  const fix=read('calendar-row-controls-fix.js');
  assert.match(fix,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)!important/);
  assert.match(fix,/\.day\{min-width:0!important;width:auto!important\}/);
  assert.match(fix,/if\(!row\|\|row\.querySelector\('\.weekToggleBtn'\)\)return/);
  assert.match(fix,/button\.textContent=hidden\?'Show row':'Hide row'/);
  assert.match(fix,/Object\.prototype\.hasOwnProperty\.call\(state,key\)\?!!state\[key\]:false/);
});

test('dashboard preload injects row controls fix while preserving required calendar scrollbar asset',()=>{
  const preload=read('cache-coherence-preload.js');
  assert.match(preload,/const BUILD = '20260902calendarstableedit1'/);
  assert.match(preload,/CRITICAL_ASSETS[\s\S]*calendar-event-scroll-fix\.js/);
  assert.match(preload,/CRITICAL_ASSETS[\s\S]*calendar-row-controls-fix\.js/);
  assert.match(preload,/billsosCalendarEventScrollFixScript/);
  assert.match(preload,/billsosCalendarRowControlsFix/);
});
