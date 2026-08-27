'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../billsos-week-toggle.js');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('late August 2026 collapses only completed full weeks 1 through 3', () => {
  assert.deepEqual(policy.fullWeeks(2026, 8), [
    { number: 1, startDay: 2, endDay: 8 },
    { number: 2, startDay: 9, endDay: 15 },
    { number: 3, startDay: 16, endDay: 22 },
    { number: 4, startDay: 23, endDay: 29 }
  ]);
  assert.deepEqual(
    policy.eligibleFullWeeks(2026, 8, new Date(2026, 7, 27)).map(week => week.number),
    [1, 2, 3]
  );
});

test('a week becomes eligible only after its final day', () => {
  assert.deepEqual(
    policy.eligibleFullWeeks(2026, 8, new Date(2026, 7, 22)).map(week => week.number),
    [1, 2]
  );
  assert.deepEqual(
    policy.eligibleFullWeeks(2026, 8, new Date(2026, 7, 23)).map(week => week.number),
    [1, 2, 3]
  );
});

test('runtime uses current panel dates, default collapse, local overrides, and bulk expansion', () => {
  const source = read('billsos-week-toggle.js');
  assert.match(source, /billsos-hidden-weeks-v2/);
  assert.match(source, /host\.dataset\.year/);
  assert.match(source, /host\.dataset\.month/);
  assert.match(source, /hasOwn\(state,key\)\?!!state\[key\]:true/);
  assert.match(source, /Expand past weeks/);
  assert.match(source, /Collapse past weeks/);
  assert.match(source, /actual\.length!==7/);
  assert.match(source, /Current week/);
});

test('all week-toggle loaders request the current cache build', () => {
  assert.match(read('billsos-sidebar-calculator.js'), /billsos-week-toggle\.js\?v=20260827weekcollapse1/);
  assert.match(read('action-log.js'), /billsos-week-toggle\.js\?v=20260827weekcollapse1/);
  assert.match(read('cache-coherence-preload.js'), /const BUILD = '20260827weekcollapse1'/);
});
