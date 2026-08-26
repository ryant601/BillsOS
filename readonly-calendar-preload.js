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
const CALCULATION_BUILD = 'cashflow-engine-20260826-fy2027-1';
const PROJECTION_HORIZON = { start: '2026-06-01', end: '2027-12-31' };

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
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
    paymentSplits: Array.isArray(source.paymentSplits) ? source.paymentSplits : [],
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
    calculationBuild: CALCULATION_BUILD,
    projectionHorizon: PROJECTION_HORIZON,
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
