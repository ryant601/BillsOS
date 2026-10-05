'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'html-hotfix-loader.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const packageJson = require('../package.json');

test('home omits bank account balance cards and snapshot requests', () => {
  assert.doesNotMatch(home, /bankBalance|savingsBalance|normalizeBillPaymentsBalance|normalizeSavingsAccountBalance/);
  assert.doesNotMatch(home, /fetch\('\/(?:bill-payments-balance|savings-account-balance|spending\/current)/);
  assert.doesNotMatch(home, /\['(?:cash|savings|spending-account)'/);
  assert.match(home, /\['upcoming','Upcoming \(14 days\)'/);
  assert.match(home, /\['income','Income remaining'/);
  assert.match(home, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('calendar projected balance and month outlook remain available', () => {
  assert.match(home, /panel\.dataset\.monthEnding/);
  assert.match(home, /function remainingMonthEnds\(\)/);
  assert.match(home, /Month-end outlook/);
  assert.match(home, /Ending balances through December/);
  assert.match(home, /data-bo-detail="forecast-/);
  assert.match(home, /setTimeout\(renderMetrics,2400\)/);
});

test('retired bank balance URLs and spending reports are unavailable', () => {
  assert.match(server, /bill-payments-balance\|savings-account-balance/);
  assert.match(server, /status\(410\)/);
  assert.doesNotMatch(server, /readStoredBalance/);
  assert.doesNotMatch(packageJson.scripts.start, /spending-route-preload|live-finances-preload/);
});

test('Home focus uses the rendered calendar days and opens the selected day', () => {
  const dark = fs.readFileSync(path.join(root, 'dark-calendar-contrast.css'), 'utf8');
  assert.match(home, /#mount \.calendar-day\[data-date\]/);
  assert.match(home, /\.calendar-day-ending b/);
  assert.match(home, /boFocus/);
  assert.match(home, /boWeek/);
  assert.match(home, /Next 7 days/);
  assert.match(home, /boAttention/);
  assert.match(home, /focusCalendarDate\(\)/);
  assert.match(home, /risk-recommendations/);
  assert.match(home, /dark-calendar-contrast\.css/);
  assert.match(dark, /calendar-day\.is-low/);
  assert.match(dark, /calendar-day\.is-negative/);
  assert.match(dark, /bo-focus/);
});
