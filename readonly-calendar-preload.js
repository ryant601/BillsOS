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

function cleanBillsData() {
  const source = readJson(BILLS_FILE, {});
  return {
    bills: Array.isArray(source.bills) ? source.bills : [],
    oneTimeEvents: Array.isArray(source.oneTimeEvents) ? source.oneTimeEvents : [],
    income: Array.isArray(source.income) ? source.income : [],
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
