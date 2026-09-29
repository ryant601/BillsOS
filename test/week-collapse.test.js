'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../billsos-week-toggle.js');

function read(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('late August 2026 collapses the Aug 1 partial row and every completed row', () => {
  assert.deepEqual(policy.calendarRows(2026, 8), [
    { number: 1, startDay: 1, endDay: 1 },
    { number: 2, startDay: 2, endDay: 8 },
    { number: 3, startDay: 9, endDay: 15 },
    { number: 4, startDay: 16, endDay: 22 },
    { number: 5, startDay: 23, endDay: 29 },
    { number: 6, startDay: 30, endDay: 31 }
  ]);
  assert.deepEqual(
    policy.eligibleRows(2026, 8, new Date(2026, 7, 28)).map(row => [row.startDay, row.endDay]),
    [[1, 1], [2, 8], [9, 15], [16, 22]]
  );
});

test('a calendar row becomes eligible only after its final real day', () => {
  assert.deepEqual(
    policy.eligibleRows(2026, 8, new Date(2026, 7, 22)).map(row => row.endDay),
    [1, 8, 15]
  );
  assert.deepEqual(
    policy.eligibleRows(2026, 8, new Date(2026, 7, 23)).map(row => row.endDay),
    [1, 8, 15, 22]
  );
});

test('September partial rows ignore blanks and stay open until their last real date passes', () => {
  assert.deepEqual(policy.calendarRows(2026, 9), [
    { number: 1, startDay: 1, endDay: 5 },
    { number: 2, startDay: 6, endDay: 12 },
    { number: 3, startDay: 13, endDay: 19 },
    { number: 4, startDay: 20, endDay: 26 },
    { number: 5, startDay: 27, endDay: 30 }
  ]);
  assert.deepEqual(policy.eligibleRows(2026, 9, new Date(2026, 8, 5)), []);
  assert.deepEqual(
    policy.eligibleRows(2026, 9, new Date(2026, 8, 6)).map(row => [row.startDay, row.endDay]),
    [[1, 5]]
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
  assert.match(source, /eligibleRows/);
  assert.match(source, /row-.*startDay.*endDay/);
  assert.match(source, /Show row/);
  assert.match(source, /Hide row/);
  assert.match(source, /Current row/);
  assert.doesNotMatch(source, /weekLabel/);
});

test('all week-toggle loaders request the current cache build', () => {
  assert.match(read('html-hotfix-loader.js'), /billsos-sidebar-calculator\.js\?v=20260828rowcollapse1/);
  assert.match(read('billsos-sidebar-calculator.js'), /billsos-week-toggle\.js\?v=20260828rowcollapse1/);
  assert.match(read('control.html'), /action-log\.js\?v=20260828rowcollapse1/);
  assert.match(read('action-log.js'), /billsos-week-toggle\.js\?v=20260828rowcollapse1/);
  assert.match(read('cache-coherence-preload.js'), /const BUILD = '20260929mortgagesplit1'/);
});
