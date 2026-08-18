'use strict';

// Registers public read-only analysis endpoints before server.js installs the login gate.
// These endpoints intentionally expose no mutation methods, credentials, or session data.
const fs = require('fs');
const path = require('path');

const expressPath = require.resolve('express');
const originalExpress = require(expressPath);
const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const CHECKMARK_FILE = path.join(DATA_DIR, 'checkmarks.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function defaultReserves(bills) {
  const mortgage = (Array.isArray(bills) ? bills : []).find(bill =>
    bill && bill.active !== false && /mortgage/i.test(String(bill.name || '')) && /rocket/i.test(String(bill.name || ''))
  );
  if (!mortgage || !Number(mortgage.amount)) return [];

  const total = Math.abs(Number(mortgage.amount));
  const firstHalf = Math.round(total * 50) / 100;
  const secondHalf = Math.round((total - firstHalf) * 100) / 100;

  return [
    {
      id: 'policy-mortgage-reserve-prior-27',
      name: 'Mortgage reserve · first half',
      amount: firstHalf,
      dueDay: 27,
      frequency: 'monthly',
      active: true,
      startMonth: '2026-08',
      targetBillId: mortgage.id,
      targetBillName: mortgage.name,
      targetDueDay: mortgage.dueDay,
      targetMonthOffset: 1,
      cashImpact: 0,
      availableCashImpact: -firstHalf,
      notes: 'Reserve from the late-month paycheck for next month’s Rocket payment.'
    },
    {
      id: 'policy-mortgage-reserve-current-13',
      name: 'Mortgage reserve · second half',
      amount: secondHalf,
      dueDay: 13,
      frequency: 'monthly',
      active: true,
      startMonth: '2026-09',
      targetBillId: mortgage.id,
      targetBillName: mortgage.name,
      targetDueDay: mortgage.dueDay,
      targetMonthOffset: 0,
      cashImpact: 0,
      availableCashImpact: -secondHalf,
      notes: 'Reserve from the mid-month paycheck before the Rocket payment on the 15th.'
    }
  ];
}

function cleanBillsData() {
  const source = readJson(BILLS_FILE, {});
  const bills = Array.isArray(source.bills) ? source.bills : [];
  return {
    bills,
    oneTimeEvents: Array.isArray(source.oneTimeEvents) ? source.oneTimeEvents : [],
    income: Array.isArray(source.income) ? source.income : [],
    reserves: Array.isArray(source.reserves) && source.reserves.length ? source.reserves : defaultReserves(bills),
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

function payload() {
  return {
    schema: 'billsos-calendar-readonly-v1',
    readOnly: true,
    generatedAt: new Date().toISOString(),
    calendar: cleanBillsData(),
    checkmarks: cleanCheckmarks()
  };
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
