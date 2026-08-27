'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('built-in navigation hides past months by default and can reveal them', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
  const navigationStart = html.indexOf('function monthKey(');
  const navigationEnd = html.indexOf('function applyCardEdits(');
  const navigation = html.slice(navigationStart, navigationEnd);

  assert.ok(navigationStart > -1 && navigationEnd > navigationStart);
  assert.match(navigation, /PAST_MONTHS_KEY/);
  assert.match(navigation, /monthKey\(m\)<currentMonthKey\(\)/);
  assert.match(navigation, /past&&!showPast\?' hidden aria-hidden="true"'/);
  assert.match(navigation, /Show past months/);
  assert.match(navigation, /Hide past months/);
  assert.match(navigation, /writePastMonths\(!readPastMonths\(\)\)/);
  assert.doesNotMatch(navigation, /api\/bills|fetch\(|MutationObserver/);
  assert.doesNotMatch(html, /past-months-ui\.js/);
  assert.doesNotMatch(packageJson, /past-months-ui-preload/);
});

test('a hidden saved month falls back to the current month', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'generated-v5.html'), 'utf8');
  assert.match(html, /savedMonth&&\(readPastMonths\(\)\|\|!isPastMonth\(savedMonth\)\)/);
  assert.match(html, /return currentMonthId\(\)/);
  assert.match(html, /if\(!show\).*?showMonth\(fallback\)/);
});
