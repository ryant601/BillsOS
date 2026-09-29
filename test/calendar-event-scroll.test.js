'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('legacy grid scroll helper remains available for rollback but is inactive',()=>{
  const legacy=read('calendar-event-scroll-fix.js'),preload=read('cache-coherence-preload.js');
  assert.match(legacy,/billsos-card-scrollrail/);
  assert.doesNotMatch(preload,/CRITICAL_ASSETS[\s\S]*calendar-event-scroll-fix\.js/);
  assert.doesNotMatch(preload,/updated = ensureCalendarEventScroll/);
});

test('active list lets transaction rows size naturally without nested scrolling',()=>{
  const css=read('calendar-list-view.css'),editor=read('billsos-card-editor.js');
  assert.match(css,/\.calendar-day \.events\{[^}]*overflow:visible/);
  assert.match(css,/height:auto!important/);
  assert.match(editor,/\.calendar-day \.events\{height:auto!important/);
  assert.match(editor,/max-height:none!important/);
});
