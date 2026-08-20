const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'day-details-enhance.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('compact calendar tiles expose their full amount in a responsive tooltip', () => {
  assert.match(source, /row\.dataset\.amountTooltip = moneyCents/);
  assert.match(source, /matchMedia\('\(max-width: 900px\)'\)/);
  assert.match(source, /pointerenter/);
  assert.match(source, /focusin/);
  assert.match(source, /role', 'tooltip/);
});

test('dashboard cache version includes the amount tooltip update', () => {
  assert.match(server, /day-details-enhance\.js\?v=20260820fundingblue1/);
});
