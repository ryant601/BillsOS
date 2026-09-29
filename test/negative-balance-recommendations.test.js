'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const list = require('../calendar-list-view.js');
const recommendations = require('../negative-balance-recommendations.js');

test('a suggested payment shift previews rescued negative days without changing the source rows', () => {
  const rows = [
    { iso: '2026-10-03', amount: -600, name: 'Flexible payment' },
    { iso: '2026-10-06', amount: 900, name: 'Paycheck' }
  ];
  const summary = list.buildMonth(rows, 2026, 10, 300, { today: '2026-10-01' });
  const suggestions = recommendations.recommend(rows, summary, '2026-10-01');
  assert.ok(suggestions.length > 0);
  assert.equal(suggestions[0].kind, 'move');
  assert.equal(suggestions[0].from, '2026-10-03');
  assert.equal(suggestions[0].to, '2026-10-06');
  assert.equal(suggestions[0].daysResolved, 3);
  assert.equal(suggestions[0].negativeDaysAfter, 0);
  assert.equal(rows[0].iso, '2026-10-03');
});

test('never recommends past payments or artificial transfers as movable bills', () => {
  const rows = [
    { iso: '2026-10-02', amount: -500, name: 'Past payment' },
    { iso: '2026-10-10', amount: -500, name: 'Funding transfer' },
    { iso: '2026-10-14', amount: 800, name: 'Paycheck' }
  ];
  const summary = list.buildMonth(rows, 2026, 10, 200, { today: '2026-10-09' });
  assert.deepEqual(recommendations.recommend(rows, summary, '2026-10-09'), []);
});

test('does not claim a fix when there is no later income date in the month', () => {
  const rows = [{ iso: '2026-10-25', amount: -600, name: 'Payment' }];
  const summary = list.buildMonth(rows, 2026, 10, 100, {});
  assert.deepEqual(recommendations.recommend(rows, summary, '2026-10-01'), []);
});
