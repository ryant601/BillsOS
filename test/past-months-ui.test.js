'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('past-month navigation is presentation-only and hidden by default', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'past-months-ui.js'), 'utf8');
  assert.match(source, /billsos-show-past-months-v1/);
  assert.match(source, /key&&key<currentKey\(\)/);
  assert.match(source, /Show past months/);
  assert.match(source, /Hide past months/);
  assert.doesNotMatch(source, /api\/bills|fetch\(/);
});
