'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const list = require('../calendar-list-view.js');

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }

test('monthly list computes every daily balance and keeps risk days visible', () => {
  const summary = list.buildMonth([
    { day: 2, iso: '2026-09-02', amount: -900, name: 'Mortgage part 1' },
    { day: 16, iso: '2026-09-16', amount: 500, name: 'Paycheck' },
    { day: 20, iso: '2026-09-20', amount: -200, name: 'Mortgage part 2' }
  ], 2026, 9, 500, { warning: 300, today: '2026-09-20' });

  assert.equal(summary.days.length, 30);
  assert.equal(summary.ending, -100);
  assert.equal(summary.lowestBalance, -400);
  assert.equal(summary.lowestDate, '2026-09-02');
  assert.equal(summary.negativeDays, 25);
  assert.ok(summary.days.find(day => day.date === '2026-09-03').visible, 'empty negative days remain visible');
  assert.ok(summary.days.find(day => day.date === '2026-09-30').visible, 'month end remains visible');
});

test('negative and current weeks expand by default while healthy weeks stay compact', () => {
  const negative = list.buildMonth([{ day: 2, amount: -600 }], 2026, 9, 500, { today: '2026-09-20' });
  const riskWeek = negative.weeks.find(week => week.negativeDays > 0 && !week.hasToday);
  const todayWeek = negative.weeks.find(week => week.hasToday);
  assert.equal(riskWeek.defaultExpanded, true);
  assert.equal(todayWeek.defaultExpanded, true);

  const healthy = list.buildMonth([{ day: 2, amount: -10 }], 2026, 9, 5000, { today: '2026-10-01' });
  assert.ok(healthy.weeks.every(week => week.defaultExpanded === false));
  assert.equal(list.STORAGE_KEY, 'billsos-list-weeks-v1');
});

test('active calendar renders a list with persistent week controls and risk line of sight', () => {
  const html = read('generated-v5.html');
  const css = read('calendar-list-view.css');
  const editor = read('billsos-card-editor.js');
  const preload = read('cache-coherence-preload.js');

  assert.match(html, /calendar-list-view\.css\?v=20260929shortshift1/);
  assert.match(html, /calendar-list-view\.js\?v=20260929shortshift1/);
  assert.match(html, /class="calendar-list"/);
  assert.match(html, /data-calendar-view="calendar"/);
  assert.match(html, /week\.days\.map\(dayHtml\)/);
  assert.match(html, /BillsOSCalendarList\.bindView\(mount\)/);
  assert.match(css, /\.calendar-box-mode \.calendar-week-body/);
  assert.match(css, /\.calendar-day\.is-quiet\{display:none\}/);
  assert.equal(list.VIEW_KEY, 'billsos-calendar-view-v1');
  assert.match(html, /negative projected day/);
  assert.match(html, /Lowest/);
  assert.match(html, /data-month-ending/);
  assert.doesNotMatch(html, /<div class="grid">/);
  assert.match(css, /\.calendar-week\.has-negative/);
  assert.match(css, /\.calendar-week-body\[hidden\]/);
  assert.match(editor, /closest\('\.calendar-day,\.day'\)/);
  assert.match(editor, /Split payment/);
  assert.match(preload, /const BUILD = '20260929shortshift1'/);
  assert.match(html, /id="openPaymentPlanner"/);
  assert.match(html, />Find a payment day</);
  assert.doesNotMatch(html, /<a href="\/control">Control Center<\/a>/);
  assert.doesNotMatch(html, /<a href="\/legacy">Legacy<\/a>/);
  assert.doesNotMatch(preload, /updated = ensureCalendarEventScroll/);
  assert.doesNotMatch(preload, /updated = ensureCalendarRowControls/);
  assert.doesNotMatch(preload, /updated = ensureCalendarSingleLineBills/);
});

test('home outlook reads the authoritative month ending from the list panel', () => {
  const source = read('html-hotfix-loader.js');
  assert.match(source, /panel\.dataset\.monthEnding/);
  assert.match(source, /\.calendar-day-ending b/);
});
