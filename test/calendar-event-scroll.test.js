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
});
