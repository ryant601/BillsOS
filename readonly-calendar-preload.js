'use strict';

// Registers public read-only analysis endpoints before server.js installs the login gate.
// These endpoints intentionally expose no mutation methods, credentials, or session data.
const fs = require('fs');
const path = require('path');

const exportOnly = process.env.BILLS_READONLY_EXPORT_ONLY === '1';
const expressPath = exportOnly ? null : require.resolve('express');
const originalExpress = exportOnly ? null : require(expressPath);
const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const CHECKMARK_FILE = path.join(DATA_DIR, 'checkmarks.json');
const READONLY_FILE = process.env.BILLS_READONLY_FILE || path.join(__dirname, 'calendar-readonly.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function defaultPaymentSplits(bills) {
  const mortgage = (Array.isArray(bills) ? bills : []).find(bill =>
    bill && bill.active !== false && /mortgage/i.test(String(bill.name || '')) && /rocket/i.test(String(bill.name || ''))
  );
  if (!mortgage || !Number(mortgage.amount)) return [];

  const total = Math.abs(Number(mortgage.amount));
  const firstHalf = Math.round(total * 50) / 100;
  const secondHalf = Math.round((total - firstHalf) * 100) / 100;

  return [
    {
      id: 'policy-mortgage-payment-prior-27',
      name: 'Mortgage payment · first half',
      amount: firstHalf,
      dueDay: 27,
      frequency: 'monthly',
      active: true,
      startMonth: '2026-08',
      targetBillId: mortgage.id,
      targetBillName: mortgage.name,
      targetDueDay: mortgage.dueDay,
      targetMonthOffset: 1,
      paymentPart: 1,
      paymentParts: 2,
      cashImpact: -firstHalf,
      notes: 'Actual first mortgage payment for the following month.'
    },
    {
      id: 'policy-mortgage-payment-current-13',
      name: 'Mortgage payment · second half',
      amount: secondHalf,
      dueDay: 13,
      frequency: 'monthly',
      active: true,
      startMonth: '2026-09',
      targetBillId: mortgage.id,
      targetBillName: mortgage.name,
      targetDueDay: mortgage.dueDay,
      targetMonthOffset: 0,
      paymentPart: 2,
      paymentParts: 2,
      cashImpact: -secondHalf,
      notes: 'Actual second mortgage payment before the 15th due date.'
    }
  ];
}

function calendarRevision(source) {
  const direct = Number(source && source.revision);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const system = (Array.isArray(source && source.oneTimeEvents) ? source.oneTimeEvents : [])
    .find(row => row && row.id === '__billsos_system_rules__');
  try {
    const rules = JSON.parse(system && system.notes || '{}');
    const nested = Number(rules && rules.calendarState && rules.calendarState.revision);
    return Number.isFinite(nested) && nested >= 0 ? nested : 0;
  } catch (_err) {
    return 0;
  }
}

function cleanBillsData(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : readJson(BILLS_FILE, {});
  const bills = Array.isArray(source.bills) ? source.bills : [];
  return {
    bills,
    oneTimeEvents: Array.isArray(source.oneTimeEvents) ? source.oneTimeEvents : [],
    income: Array.isArray(source.income) ? source.income : [],
    paymentSplits: Array.isArray(source.paymentSplits) && source.paymentSplits.length
      ? source.paymentSplits
      : defaultPaymentSplits(bills),
    updatedAt: source.updatedAt || null
  };
}

function cleanCheckmarks() {
  const source = readJson(CHECKMARK_FILE, {});
  return {
    completed: source.completed && typeof source.completed === 'object' && !Array.isArray(source.completed)
      ? source.completed
      : {},
    updatedAt: source.updatedAt || null
  };
}

function payload(calendarInput) {
  const calendar = cleanBillsData(calendarInput);
  return {
    schema: 'billsos-calendar-readonly-v1',
    readOnly: true,
    revision: calendarRevision(calendarInput || calendar),
    generatedAt: new Date().toISOString(),
    calendar,
    checkmarks: cleanCheckmarks()
  };
}

function writeReadonlySnapshot(calendar) {
  const exported = payload(calendar);
  const tmp = READONLY_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(exported));
  fs.renameSync(tmp, READONLY_FILE);
  return exported;
}

function setReadonlyHeaders(res, cacheControl) {
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

function readonlyApi(_req, res) {
  setReadonlyHeaders(res, 'no-store');
  res.json(payload());
}

function readonlyJson(_req, res) {
  // Short-lived public caching makes this easier for generic web fetchers/CDNs
  // while keeping calendar analysis effectively current.
  setReadonlyHeaders(res, 'public, max-age=30, s-maxage=30, stale-while-revalidate=30');
  res.type('application/json').send(JSON.stringify(payload()));
}

if (!exportOnly) {
  function wrappedExpress(...args) {
    const app = originalExpress(...args);
    app.get('/api/calendar-readonly', readonlyApi);
    app.get('/calendar-readonly.json', readonlyJson);
    return app;
  }

  Object.keys(originalExpress).forEach(key => {
    wrappedExpress[key] = originalExpress[key];
  });
  Object.setPrototypeOf(wrappedExpress, Object.getPrototypeOf(originalExpress));
  require.cache[expressPath].exports = wrappedExpress;
}

module.exports = { calendarRevision, payload, writeReadonlySnapshot };
