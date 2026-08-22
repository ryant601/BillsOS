'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  applyCalendarStatePatch,
  findSystemRow,
  sameSourceVersion
} = require('../bills-data-integrity');

function systemState(data) {
  return JSON.parse(findSystemRow(data).notes).calendarState;
}

test('stale device calendar state cannot overwrite a newer funding refinement', () => {
  const existing = {
    bills: [{ id: 'bill-1', name: 'Mortgage', amount: 5866.48 }],
    oneTimeEvents: [
      { id: 'one-1', name: 'Deck #1', date: '2026-08-24', amount: -148, type: 'adjustment' },
      {
        id: '__billsos_system_rules__',
        name: 'BillsOS system rules',
        type: 'meta',
        amount: 0,
        date: null,
        notes: JSON.stringify({
          calendarState: {
            dateAdjustments: {},
            amountAdjustments: {
              '2026-08-21|Fund Spending Account|-1500': {
                amount: 2250,
                updatedAt: '2026-08-22T13:10:00.000Z'
              }
            },
            completed: { paid: 1 },
            updatedAt: '2026-08-22T13:10:00.000Z',
            revision: 12
          }
        })
      }
    ],
    income: [{ id: 'income-1', name: 'Paycheck', amount: 1000 }],
    paymentSplits: [{ id: 'mortgage-1', amount: 2933.24 }],
    revision: 12,
    updatedAt: '2026-08-22T13:10:00.000Z'
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 7,
    calendarState: {
      dateAdjustments: {},
      amountAdjustments: {
        '2026-08-21|Fund Spending Account|-1500': {
          amount: 1500,
          updatedAt: '2026-08-22T12:00:00.000Z'
        },
        '2026-09-04|Fund Spending Account|-1500': {
          amount: 2000,
          updatedAt: '2026-08-22T13:11:00.000Z'
        }
      },
      completed: {},
      revision: 7
    }
  }, '2026-08-22T13:12:00.000Z');

  const state = systemState(patched);
  assert.equal(state.amountAdjustments['2026-08-21|Fund Spending Account|-1500'].amount, 2250);
  assert.equal(state.amountAdjustments['2026-09-04|Fund Spending Account|-1500'].amount, 2000);
  assert.deepEqual(state.completed, { paid: 1 });
  assert.equal(state.revision, 13);
  assert.equal(patched.revision, 13);
});

test('calendar-only sync preserves one-time events, bills, income, and payment splits', () => {
  const existing = {
    bills: [{ id: 'bill-1', name: 'Existing bill' }],
    oneTimeEvents: [
      { id: 'one-a', name: 'One-time A', date: '2026-08-24', amount: -148 },
      { id: 'one-b', name: 'One-time B', date: '2026-08-26', amount: -250 }
    ],
    income: [{ id: 'income-1', name: 'Paycheck' }],
    paymentSplits: [{ id: 'split-1', amount: 500 }],
    revision: 0,
    updatedAt: '2026-08-22T12:00:00.000Z'
  };
  const patched = applyCalendarStatePatch(existing, {
    baseRevision: 0,
    calendarState: {
      dateAdjustments: {},
      amountAdjustments: {
        funding: { amount: 2000, updatedAt: '2026-08-22T13:00:00.000Z' }
      },
      completed: {},
      revision: 0
    }
  }, '2026-08-22T13:00:01.000Z');

  assert.deepEqual(patched.bills, existing.bills);
  assert.deepEqual(patched.oneTimeEvents.filter(row => row.id !== '__billsos_system_rules__'), existing.oneTimeEvents);
  assert.deepEqual(patched.income, existing.income);
  assert.deepEqual(patched.paymentSplits, existing.paymentSplits);
});

test('full-document saves reject a stale source version before replacement', () => {
  const current = { updatedAt: '2026-08-22T13:10:23.154Z' };
  const stalePhone = { updatedAt: '2026-08-22T12:49:30.548Z' };
  assert.equal(sameSourceVersion(current, stalePhone), false);
  assert.equal(sameSourceVersion(current, { updatedAt: current.updatedAt }), true);
});

test('browser calendar sync uses the calendar-state-only endpoint', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-cross-device-sync-v2.js'), 'utf8');
  assert.match(source, /fetch\('\/api\/bills\/calendar-state',\{method:'PATCH'/);
  assert.doesNotMatch(source, /fetch\('\/api\/bills',\{method:'POST'/);
  assert.doesNotMatch(source, /RECENT_LOCAL_MS|localContributed/);
});
