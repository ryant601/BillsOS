'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live-finances');
const FILES = Object.freeze({
  'spending/current.json': { type: 'json' },
  'bill-payments-balance.json': { type: 'json' },
  'savings-account-balance.json': { type: 'json' },
  'spending-last-pull.json': { type: 'json' },
  'spending-data-stamp.js': { type: 'text' }
});

function ensureLiveDir() {
  fs.mkdirSync(LIVE_DIR, { recursive: true });
}

function livePath(name) {
  return path.join(LIVE_DIR, name);
}

function atomicWrite(name, value, type) {
  const target = livePath(name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp-' + process.pid;
  const body = type === 'json' ? JSON.stringify(value, null, 2) + '\n' : String(value);
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, target);
}

function validFiniteAvailable(obj) {
  const available = obj && obj.balance && obj.balance.available;
  return obj && Number.isFinite(available) && typeof obj.bankingAsOf === 'string' && obj.bankingAsOf.length > 0;
}

function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected JSON object');
  const files = body.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Expected files object');
  const names = Object.keys(files);
  if (!names.length) throw new Error('No files supplied');
  for (const name of names) {
    if (!FILES[name]) throw new Error('Unsupported live file: ' + name);
  }
  for (const name of ['bill-payments-balance.json', 'savings-account-balance.json']) {
    if (Object.prototype.hasOwnProperty.call(files, name) && !validFiniteAvailable(files[name])) {
      throw new Error(name + ' requires finite available and bankingAsOf');
    }
  }
  const pull = files['spending-last-pull.json'];
  if (pull && (!pull.pulledAt || !pull.bankingAsOf || pull.source !== 'Finances')) {
    throw new Error('Invalid spending-last-pull.json');
  }
  return files;
}

function readLive(name) {
  const target = livePath(name);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, 'utf8');
}

function persistFiles(files) {
  ensureLiveDir();
  const staging = path.join(LIVE_DIR, '.staging-' + Date.now() + '-' + process.pid);
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const [name, value] of Object.entries(files)) {
      const spec = FILES[name];
      const target = path.join(staging, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const body = spec.type === 'json' ? JSON.stringify(value, null, 2) + '\n' : String(value);
      fs.writeFileSync(target, body, 'utf8');
    }
    for (const name of Object.keys(files)) {
      const staged = path.join(staging, name);
      const target = livePath(name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(staged, target);
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function ingestRailwayPayload() {
  const raw = process.env.BILLS_FINANCES_PAYLOAD;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const files = validatePayload(parsed);
    persistFiles(files);
    const pull = files['spending-last-pull.json'];
    console.log('[BillsOS] Railway Finances payload persisted' + (pull && pull.pulledAt ? ' for ' + pull.pulledAt : ''));
  } catch (error) {
    console.error('[BillsOS] Railway Finances payload rejected:', error && error.message ? error.message : error);
  }
}

ingestRailwayPayload();

const originalStatic = express.static;
express.static = function billsOsLiveFinanceStatic(root, options) {
  const fallback = originalStatic.call(express, root, options);
  return function liveFinanceFirst(req, res, next) {
    const url = decodeURIComponent(String(req.url || '').split('?')[0]).replace(/^\/+/, '');
    const spec = FILES[url];
    if (spec) {
      const body = readLive(url);
      if (body !== null) {
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Content-Type', spec.type === 'json' ? 'application/json; charset=utf-8' : 'application/javascript; charset=utf-8');
        return res.status(200).send(body);
      }
    }
    return fallback(req, res, next);
  };
};

const originalListen = express.application.listen;
express.application.listen = function billsOsLiveFinanceListen() {
  const app = this;

  app.post('/api/finances-refresh', (req, res) => {
    try {
      if (!req.billsosSession || req.billsosSession.role !== 'owner') {
        return res.status(403).json({ error: 'Owner authentication required' });
      }
      const files = validatePayload(req.body);
      persistFiles(files);
      return res.status(200).json({
        ok: true,
        storedAt: new Date().toISOString(),
        files: Object.keys(files)
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Could not persist Finances refresh' });
    }
  });

  app.get('/api/finances-refresh/status', (req, res) => {
    if (!req.billsosSession || req.billsosSession.role !== 'owner') {
      return res.status(403).json({ error: 'Owner authentication required' });
    }
    const pull = readLive('spending-last-pull.json');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ live: !!pull, lastPull: pull ? JSON.parse(pull) : null });
  });

  return originalListen.apply(app, arguments);
};

module.exports = { FILES, LIVE_DIR, validatePayload, atomicWrite };
