'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('calendar day event boxes keep the fixed internal scrolling viewport', () => {
  const fix = read('calendar-event-scroll-fix.js');
  assert.match(fix, /\.day:not\(\.is-blank\):not\(\.is-past\)\{/);
  assert.match(fix, /height:172px!important/);
  assert.match(fix, /height:76px!important/);
  assert.match(fix, /overflow-y:auto!important/);
  assert.match(fix, /overflow-x:hidden!important/);
  assert.match(fix, /touch-action:pan-y!important/);
  assert.match(fix, /-webkit-overflow-scrolling:touch!important/);
});

test('calendar busy cards render the BillsOS-owned visible scrollbar', () => {
  const fix = read('calendar-event-scroll-fix.js');
  assert.match(fix, /billsos-card-scrollrail/);
  assert.match(fix, /billsos-card-scrollthumb/);
  assert.match(fix, /billsos-has-scroll/);
  assert.match(fix, /function installRail\(el\)/);
  assert.match(fix, /function updateRail\(el\)/);
  assert.match(fix, /pointerdown/);
  assert.match(fix, /customScrollbar:\s*true/);
});

test('custom calendar scrollbar is mandatory in the dashboard preload path', () => {
  const preload = read('cache-coherence-preload.js');
  assert.match(preload, /calendar-event-scroll-fix\.js/);
  assert.match(preload, /calendar-event-scroll-fix\.js\?v=' \+ BUILD/);
  assert.match(preload, /billsosCalendarEventScrollFixScript/);
  assert.match(preload, /CRITICAL_ASSETS[\s\S]*calendar-event-scroll-fix\.js/);
  assert.match(preload, /CRITICAL_ASSETS[\s\S]*billsos-card-editor\.js/);
});

test('calendar pill helper keeps complete names and amounts without installing a second date editor', () => {
  const source = read('calendar-single-line-bills.js');
  assert.match(source, /billsosSingleLineBillStyles/);
  assert.match(source, /container-type:inline-size/);
  assert.match(source, /height:auto!important/);
  assert.match(source, /max-height:none!important/);
  assert.match(source, /white-space:normal!important/);
  assert.match(source, /overflow-wrap:anywhere!important/);
  assert.match(source, /-webkit-line-clamp:unset!important/);
  assert.match(source, /white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important/);
  assert.doesNotMatch(source, /text-overflow:ellipsis/);
  assert.doesNotMatch(source, /billsosStableEdit|openStableEditor|DATE_KEY|billsos-pay-adjust/);
});

test('card editor preserves the fixed viewport and compacts events without replacing the BillsOS scrollbar', () => {
  const editor = read('billsos-card-editor.js');
  assert.match(editor, /height:172px!important;min-height:172px!important;max-height:172px!important/);
  assert.match(editor, /flex:0 0 76px!important;height:76px!important/);
  assert.match(editor, /scrollbar-width:none!important/);
  assert.match(editor, /min-height:35px!important/);
  assert.match(editor, /grid-template-columns:minmax\(0,1fr\)!important/);
  assert.doesNotMatch(editor, /grid-template-columns:18px minmax\(0,1fr\) 22px 22px/);
});
