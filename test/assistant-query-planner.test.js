const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const planner = require('../assistant-api')._test;

const data = {
  bills: [
    { name: 'Jeep', type: 'bill' },
    { name: 'Mortgage (Rocket)', type: 'bill' }
  ],
  income: [{ name: 'Ryan Paycheck', type: 'income' }],
  oneTimeEvents: [{ name: 'Fund Spending Account', type: 'transfer' }]
};

test('funding amount question becomes a dated funding event query', () => {
  const plan = planner.localPlan('what are the funding transfer amounts in October?', null, data);
  assert.equal(plan.operation, 'event_list');
  assert.equal(plan.eventKind, 'funding');
  assert.equal(plan.flow, 'transfer');
  assert.equal(plan.dateStart, '2026-10-01');
  assert.equal(plan.dateEnd, '2026-10-31');
  assert.equal(plan.completion, 'all');
});

test('aggregation and amount filters compose with event kinds and periods', () => {
  const total = planner.localPlan('what is the total funding in October?', null, data);
  assert.equal(total.operation, 'event_aggregate');
  assert.equal(total.aggregation, 'sum');
  assert.equal(total.eventKind, 'funding');

  const filtered = planner.localPlan('show bills over $500 in November', null, data);
  assert.equal(filtered.operation, 'event_list');
  assert.equal(filtered.eventKind, 'bill');
  assert.equal(filtered.amountComparator, 'gt');
  assert.equal(filtered.amountThreshold, 500);
  assert.equal(filtered.dateStart, '2026-11-01');
});

test('known calendar entities are resolved without an exact question template', () => {
  const plan = planner.localPlan('what happens with the Jeep in October?', null, data);
  assert.equal(plan.operation, 'event_list');
  assert.equal(plan.entity, 'Jeep');
  assert.equal(plan.flow, 'outflow');
});

test('summary is explicit and an unsupported question asks for clarification', () => {
  assert.equal(planner.localPlan('give me an October overview', null, data).operation, 'summary');
  assert.equal(planner.localPlan('what is my October summary?', null, data).operation, 'summary');
  const unknown = planner.localPlan('tell me something interesting', null, data);
  assert.equal(unknown.operation, 'unknown');
  assert.match(unknown.clarificationQuestion, /what would you like/i);
});

test('comparison composes with a funding filter across available months', () => {
  const plan = planner.localPlan('compare monthly funding transfers', null, data);
  assert.equal(plan.operation, 'period_compare');
  assert.equal(plan.eventKind, 'funding');
  assert.equal(plan.flow, 'transfer');
  assert.equal(plan.dateStart, '2026-06-01');
  assert.equal(plan.dateEnd, '2027-03-31');
});

test('Q1 month questions resolve to the 2027 projection', () => {
  const plan = planner.localPlan('show my bills in January', null, data);
  assert.equal(plan.operation, 'event_list');
  assert.equal(plan.dateStart, '2027-01-01');
  assert.equal(plan.dateEnd, '2027-01-31');
});

test('Q1 questions use January through March 2027', () => {
  const plan = planner.localPlan('give me a Q1 2027 summary', null, data);
  assert.equal(plan.operation, 'summary');
  assert.equal(plan.dateStart, '2027-01-01');
  assert.equal(plan.dateEnd, '2027-03-31');
  assert.equal(plan.scopeLabel, 'Q1 2027');
});

test('follow-up periods retain the previous calculation', () => {
  const first = planner.localPlan('what is the total funding in October?', null, data);
  const followup = planner.localPlan('what about November?', first, data);
  assert.equal(followup.operation, 'event_aggregate');
  assert.equal(followup.eventKind, 'funding');
  assert.equal(followup.aggregation, 'sum');
  assert.equal(followup.dateStart, '2026-11-01');
});

test('semantic correction rejects an unrelated model summary', () => {
  const corrected = planner.correctPlan('what are the funding transfer amounts in October?', {
    operation: 'summary',
    eventKind: 'all',
    flow: 'all',
    dateStart: '2026-10-01',
    dateEnd: '2026-10-31',
    confidence: 0.9
  }, null, data);
  assert.equal(corrected.operation, 'event_list');
  assert.equal(corrected.eventKind, 'funding');
  assert.equal(corrected.flow, 'transfer');
});

test('generic model entity labels do not hide classified events', () => {
  const corrected = planner.correctPlan('list funding transfers in October', {
    operation: 'event_list',
    eventKind: 'funding',
    flow: 'transfer',
    entity: 'funding transfers',
    dateStart: '2026-10-01',
    dateEnd: '2026-10-31'
  }, null, data);
  assert.equal(corrected.entity, null);
});

test('answer rewriting must preserve requested subject, dates, and amounts', () => {
  const deterministic = 'October funding transfers\nFri, Oct 2 · $1,500.00\nFri, Oct 16 · $1,500.00\nTotal $3,000.00';
  assert.equal(planner.answerPreservesFacts(
    'funding transfers in October',
    deterministic,
    'October funding transfers: October 2 — $1,500; October 16 — $1,500; total $3,000.'
  ), true);
  assert.equal(planner.answerPreservesFacts(
    'funding transfers in October',
    deterministic,
    'October summary: total outflow $3,000.'
  ), false);
  assert.equal(planner.answerPreservesFacts(
    'tell me something interesting',
    'One detail would help. What would you like me to calculate?',
    'Your finances look healthy this month.'
  ), false);
});

test('browser assistant has no automatic summary fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'assistant-ui.js'), 'utf8');
  assert.match(source, /operation:'unknown'/);
  assert.match(source, /engine&&engine\.transferKind/);
  assert.match(source, /if\(p\.operation==='summary'\)return summary/);
  assert.doesNotMatch(source, /return summary\(cal,p,s\)\}\s*function addMsg/);
  assert.doesNotMatch(source, /low\.indexOf\('balance correction'\)/);
});

test('assistant answers use explicit title, total, and row styles', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'assistant-ui.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(__dirname, '..', 'assistant-ai-bridge.js'), 'utf8');
  assert.match(ui, /billsos-ai-answer-title/);
  assert.match(ui, /billsos-ai-answer-total/);
  assert.match(ui, /billsos-ai-answer-list/);
  assert.match(bridge, /billsos-ai-answer-title/);
  assert.match(bridge, /billsos-ai-answer-total/);
  assert.match(bridge, /billsos-ai-answer-list/);
  assert.doesNotMatch(bridge, /<b>'\+esc\(lines\[0\]/);
});
