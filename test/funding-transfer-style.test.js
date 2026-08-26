const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../cashflow-engine');

test('funding transfer classification covers stored and generated variants', () => {
  const funding = [
    { name: 'Fund Spending Account', type: 'transfer', amount: -1500 },
    { name: 'Fund Spending Account', type: 'spending', amount: -1500 },
    { name: 'Fund Spending Account', type: 'bill', amount: -1500 },
    { name: 'Spending account funding', type: 'rule', amount: -1500 },
    { name: 'Funding transfer', type: 'transfer', amount: -500 },
    { name: 'Fund Spending Account · 1/2', type: 'split-payment', amount: -750 },
    { name: 'Move cash', type: 'spending-funding', amount: -400 }
  ];
  funding.forEach(row => assert.equal(engine.transferKind(row), 'funding', JSON.stringify(row)));
  assert.equal(engine.calendarClass({ name: 'Fund Spending Account', type: 'bill', amount: -1500 }), 'funding');
});

test('other semantic calendar colors stay distinct', () => {
  assert.equal(engine.calendarClass({ name: 'Paycheck', type: 'income', amount: 1000 }), 'in');
  assert.equal(engine.calendarClass({ name: 'Electric', type: 'bill', amount: -200 }), 'out');
  assert.equal(engine.calendarClass({ name: 'Emergency Transfer', type: 'transfer', amount: -100 }), 'xfer');
  assert.equal(engine.calendarClass({ name: 'Sweep transfer', type: 'transfer', amount: -100 }), 'sweep');
});

test('desktop, week, mobile, and detail selectors share the funding palette', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'day-details-enhance.js'), 'utf8');
  assert.match(source, /\.ev\.funding\{background:#E8F3FA/);
  assert.match(source, /\.billsos-week-days \.day \.ev\.funding/);
  assert.match(source, /\.detailItem\.funding\{background:#F0F7FB/);
  assert.match(source, /\.mobile-sheet \.detailItem\.funding/);
  assert.match(source, /item\.classList\.toggle\('funding'/);
});

test('every direct calendar asset reference uses the current calendar cache build', () => {
  const files = ['generated-v5.html', 'server.js', 'assistant-api.js', 'action-log.js', 'billsos-sidebar-calculator.js'];
  files.forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const relevant = source.split(/\r?\n/).filter(line => /(?:cashflow-engine|day-details-enhance|billsos-week-toggle)\.js\?v=/.test(line));
    relevant.forEach(line => assert.match(line, /v=20260826q12027a/, file + ': ' + line));
  });
});

test('the month and week helper remains valid JavaScript', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'billsos-week-toggle.js'), 'utf8');
  assert.doesNotThrow(() => new Function(source));
});
