'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('Control Center hides ended bills, preserves paused/future bills, and can reveal history', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'control.html'), 'utf8');
  const source = html.slice(html.indexOf('function isEndedBill('), html.indexOf('\n', html.indexOf('function renderBills(')));
  const nodes = { billCount: {}, billsTable: {}, toggleEndedBills: { setAttribute(name, value) { this[name] = value; } } };
  const saved = new Map();
  const state = { bills: [
    { id: 'old', name: 'Finished loan', lifecycleStatus: 'ended' },
    { id: 'expired', name: 'Expired subscription', endMonth: '2026-09' },
    { id: 'paused', name: 'Paused bill', lifecycleStatus: 'paused', endMonth: '2026-09' },
    { id: 'current', name: 'Current bill', endMonth: '2026-10' },
    { id: 'future', name: 'Future ending', endMonth: '2027-07' }
  ] };
  const before = JSON.stringify(state);
  const context = { state, document: { getElementById: id => nodes[id] },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    currentMonth: () => '2026-10', normalizePayMethod: () => 'manual', esc: v => String(v), money: v => String(v), monthLabel: v => v };
  vm.runInNewContext(source, context);
  context.renderBills();
  assert.doesNotMatch(nodes.billsTable.innerHTML, /Finished loan|Expired subscription/);
  assert.match(nodes.billsTable.innerHTML, /Paused bill/);
  assert.match(nodes.billsTable.innerHTML, /Current bill/);
  assert.match(nodes.billsTable.innerHTML, /Future ending/);
  assert.equal(nodes.billCount.textContent, '3 bills · 2 ended hidden');
  context.toggleEndedBills();
  assert.match(nodes.billsTable.innerHTML, /Finished loan/);
  assert.equal(nodes.toggleEndedBills['aria-pressed'], 'true');
  assert.equal(saved.get('billsos-control-show-ended-v1'), 'true');
  context.toggleEndedBills();
  assert.doesNotMatch(nodes.billsTable.innerHTML, /Finished loan/);
  assert.equal(JSON.stringify(state), before, 'visibility does not modify billing data or history');
});
