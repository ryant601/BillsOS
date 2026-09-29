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

test('recommends an October mortgage split in September when it prevents future negative days', () => {
  const september = list.buildMonth([], 2026, 9, 1000, {});
  const rows = [
    { iso: '2026-10-02', amount: -1200, name: 'Mortgage' },
    { iso: '2026-10-15', amount: 1000, name: 'Paycheck' }
  ];
  const october = list.buildMonth(rows, 2026, 10, september.ending, {});
  const suggestions = recommendations.recommendAhead(rows, september.days.concat(october.days), '2026-09-29', 120);
  assert.equal(suggestions[0].kind, 'mortgage');
  assert.equal(suggestions[0].firstDate, '2026-10-02');
  assert.equal(suggestions[0].secondDate, '2026-10-15');
  assert.equal(suggestions[0].firstAmount + suggestions[0].secondAmount, 1200);
  assert.equal(suggestions[0].negativeDaysAfter, 0);
});

test('mortgage and Jeep splits obey their 17th and 25th cutoffs; fixed lenders stay excluded', () => {
  const rows = [
    { iso: '2026-10-02', amount: -1200, name: 'Mortgage' },
    { iso: '2026-10-18', amount: 1000, name: 'Paycheck' },
    { iso: '2026-10-20', amount: -800, name: 'Jeep' },
    { iso: '2026-10-26', amount: 1000, name: 'Paycheck' },
    { iso: '2026-10-20', amount: -400, name: 'Chase' },
    { iso: '2026-10-20', amount: -500, name: 'Upstart' }
  ];
  const summary = list.buildMonth(rows, 2026, 10, 800, {});
  const choices = recommendations.recommendAhead(rows, summary.days, '2026-10-01', 120);
  assert.ok(choices.every(choice => choice.secondDate <= choice.from.slice(0, 8) + (choice.kind === 'mortgage' ? '17' : '25')));
  assert.ok(choices.every(choice => !/chase|upstart/i.test(choice.name)));
  const monthly = recommendations.recommend(rows, summary, '2026-10-01');
  assert.ok(monthly.every(choice => !/chase|upstart/i.test(choice.name)));
  assert.ok(monthly.every(choice => !/mortgage/i.test(choice.name) || Number(choice.to.slice(-2)) <= 17));
  assert.ok(monthly.every(choice => !/jeep/i.test(choice.name) || Number(choice.to.slice(-2)) <= 25));
});

test('a deadline split can ease a due-day deficit without moving the full bill beyond its cutoff', () => {
  const rows = [{ iso: '2026-10-16', amount: -1200, name: 'Mortgage' }];
  const summary = list.buildMonth(rows, 2026, 10, 1000, {});
  const choices = recommendations.recommendAhead(rows, summary.days, '2026-10-01', 120);
  assert.equal(choices[0].firstDate, '2026-10-16');
  assert.equal(choices[0].secondDate, '2026-10-17');
  assert.equal(choices[0].daysResolved, 1);
  assert.ok(choices[0].negativeDaysAfter > 0, 'remaining negative days must be reported');
});

test('monthly suggestions address low balances below $300 without needing a negative day', () => {
  const rows = [
    { iso: '2026-10-03', amount: -250, name: 'Flexible payment' },
    { iso: '2026-10-06', amount: 500, name: 'Paycheck' }
  ];
  const summary = list.buildMonth(rows, 2026, 10, 400, {});
  const choices = recommendations.recommend(rows, summary, '2026-10-01');
  assert.ok(choices.length);
  assert.equal(choices[0].negativeDaysBefore, 0);
  assert.equal(choices[0].negativeDaysAfter, 0);
  assert.equal(choices[0].below300DaysAfter, 0);
  assert.equal(choices[0].daysResolved, 3);
});

test('future mortgage split addresses low-only days while respecting the 17th', () => {
  const rows = [
    { iso: '2026-10-02', amount: -400, name: 'Mortgage' },
    { iso: '2026-10-15', amount: 500, name: 'Paycheck' }
  ];
  const summary = list.buildMonth(rows, 2026, 10, 600, {});
  const choices = recommendations.recommendAhead(rows, summary.days, '2026-10-01', 120);
  assert.ok(choices.length);
  assert.equal(choices[0].negativeDaysBefore, 0);
  assert.equal(choices[0].negativeDaysAfter, 0);
  assert.equal(choices[0].below300DaysAfter, 0);
  assert.ok(choices[0].secondDate <= '2026-10-17');
});

test('October income can reserve part of a November mortgage without creating a new low day', () => {
  const octoberRows = [{ iso: '2026-10-20', amount: 600, name: 'Paycheck' }];
  const october = list.buildMonth(octoberRows, 2026, 10, 500, {});
  const novemberRows = [
    { iso: '2026-11-02', amount: -1000, name: 'Mortgage' },
    { iso: '2026-11-15', amount: 800, name: 'Paycheck' }
  ];
  const november = list.buildMonth(novemberRows, 2026, 11, october.ending, {});
  const choices = recommendations.recommendAhead(octoberRows.concat(novemberRows), october.days.concat(november.days), '2026-10-01', 120);
  const choice = choices.find(item => item.from === '2026-11-02' && item.firstDate === '2026-10-20');
  assert.ok(choice);
  assert.equal(choice.secondDate, '2026-11-15');
  assert.equal(choice.negativeDaysAfter, 0);
  assert.equal(choice.below300DaysAfter, 0);
});
