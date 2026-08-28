'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('calendar day event boxes remain vertically scrollable inside fixed cards', () => {
  const fix = read('calendar-event-scroll-fix.js');
  assert.match(fix, /\.day:not\(\.is-blank\):not\(\.is-past\)\{/);
  assert.match(fix, /height:172px!important/);
  assert.match(fix, /flex:1 1 auto!important/);
  assert.match(fix, /min-height:0!important/);
  assert.match(fix, /overflow-y:auto!important/);
  assert.match(fix, /overflow-x:hidden!important/);
  assert.match(fix, /scrollbar-gutter:stable/);
  assert.match(fix, /touch-action:pan-y!important/);
  assert.match(fix, /-webkit-overflow-scrolling:touch!important/);
});

test('scroll fix is injected after the calendar markup with a cache-busted build', () => {
  const preload = read('cache-coherence-preload.js');
  assert.match(preload, /const BUILD = '20260828calendarscroll2'/);
  assert.match(preload, /calendar-event-scroll-fix\.js\?v=' \+ BUILD/);
  assert.match(preload, /billsosCalendarEventScrollFixScript/);
});
