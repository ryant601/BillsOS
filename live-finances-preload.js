'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { verifyData } = require('./scripts/verify-spending-snapshot');

const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live-finances');
const FILES = Object.freeze({
  'spending/current.json': { type: 'json' },
  'bill-payments-balance.json': { type: 'json' },
  'savings-account-balance.json': { type: 'json' },
  'spending-last-pull.json': { type: 'json' },
  'spending-data-stamp.js': { type: 'text' }
});
const REFRESH_FILES = Object.freeze([
  'spending/current.json',
  'bill-payments-balance.json',
  'savings-account-balance.json',
  'spending-last-pull.json'
]);

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

function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected JSON object');
  const files = body.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Expected files object');
  const names = Object.keys(files);
  for (const name of names) {
    if (!FILES[name]) throw new Error('Unsupported live file: ' + name);
  }
  const missing = REFRESH_FILES.filter(name => !Object.prototype.hasOwnProperty.call(files, name));
  const extra = names.filter(name => !REFRESH_FILES.includes(name));
  if (missing.length || extra.length) {
    throw new Error('Refresh requires exactly four files' +
      (missing.length ? '; missing: ' + missing.join(', ') : '') +
      (extra.length ? '; unexpected: ' + extra.join(', ') : ''));
  }
  verifyData(
    files['spending/current.json'],
    files['spending-last-pull.json'],
    files['bill-payments-balance.json'],
    files['savings-account-balance.json']
  );
  const bankingAsOf = files['spending-last-pull.json'].bankingAsOf;
  if (files['bill-payments-balance.json'].bankingAsOf !== bankingAsOf ||
      files['savings-account-balance.json'].bankingAsOf !== bankingAsOf) {
    throw new Error('All four files must come from the same Finances banking snapshot');
  }
  return files;
}

function readLive(name) {
  const target = livePath(name);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, 'utf8');
}

function readLiveJson(name) {
  const body = readLive(name);
  if (body === null) return null;
  try { return JSON.parse(body); }
  catch (_error) { return null; }
}

function bankingTime(files) {
  return Date.parse(files['spending-last-pull.json'].bankingAsOf);
}

function assertNewer(files) {
  const existing = readLiveJson('spending-last-pull.json');
  if (!existing || !Number.isFinite(Date.parse(existing.bankingAsOf))) return;
  if (bankingTime(files) <= Date.parse(existing.bankingAsOf)) {
    const error = new Error('Finances banking snapshot did not advance; live files were preserved');
    error.status = 409;
    throw error;
  }
}

function persistFiles(files, options = {}) {
  if (options.requireNewer) assertNewer(files);
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
    return refreshStatus();
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function fileReceipt(name) {
  const target = livePath(name);
  if (!fs.existsSync(target)) return null;
  const body = fs.readFileSync(target);
  const stat = fs.statSync(target);
  return {
    name,
    bytes: body.length,
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
    updatedAt: stat.mtime.toISOString()
  };
}

function refreshStatus() {
  const pull = readLiveJson('spending-last-pull.json');
  return {
    live: !!pull,
    lastPull: pull,
    files: REFRESH_FILES.map(fileReceipt).filter(Boolean)
  };
}

function ingestRailwayPayload() {
  const raw = process.env.BILLS_FINANCES_PAYLOAD;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const files = validatePayload(parsed);
    const existing = readLiveJson('spending-last-pull.json');
    if (existing && Number.isFinite(Date.parse(existing.bankingAsOf)) &&
        bankingTime(files) <= Date.parse(existing.bankingAsOf)) {
      console.log('[BillsOS] Railway Finances payload skipped because the volume snapshot is newer or equal');
      return;
    }
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

function refreshPage() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Refresh Finances · BillsOS</title><style>
body{margin:0;background:#faf9f5;color:#1f1e1d;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:760px;margin:0 auto;padding:28px 18px}.card{background:#fff;border:1px solid #e3dfd3;border-radius:18px;padding:20px;box-shadow:0 8px 30px rgba(31,30,29,.06)}h1{margin:0 0 6px;font-size:28px}p{color:#6b6a63}textarea{width:100%;min-height:320px;box-sizing:border-box;border:1px solid #d8d2c7;border-radius:12px;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}button{margin-top:12px;border:0;border-radius:10px;background:#2c6446;color:#fff;padding:12px 16px;font-weight:700;cursor:pointer}button:disabled{opacity:.55}.status{margin-top:14px;padding:12px;border-radius:10px;background:#f7f5ef;white-space:pre-wrap}.ok{color:#22543d}.bad{color:#9a3b2d}a{color:#2c6446}</style></head><body><main class="shell"><div class="card"><h1>Refresh Finances</h1><p>Owner-only import to Railway's persistent volume. The four-file snapshot is validated together and never written to GitHub.</p><textarea id="payload" aria-label="Validated Finances JSON payload" spellcheck="false" placeholder='{"files":{"spending/current.json":{},"bill-payments-balance.json":{},"savings-account-balance.json":{},"spending-last-pull.json":{}}}'></textarea><button id="publish" type="button">Validate and publish</button><div id="status" class="status" role="status" aria-live="polite">Waiting for a four-file snapshot.</div><p><a href="/spending/">Return to Everyday Spending</a></p></div></main><script>
const button=document.getElementById('publish'),status=document.getElementById('status'),payload=document.getElementById('payload');
button.onclick=async()=>{button.disabled=true;status.className='status';status.textContent='Validating…';try{const parsed=JSON.parse(payload.value);const response=await fetch('/api/finances-refresh',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(parsed)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Refresh failed');status.className='status ok';status.textContent='Published '+data.files.length+' files. Banking snapshot: '+data.bankingAsOf+'\\nReceipt: '+data.files.map(file=>file.name+' '+file.sha256.slice(0,12)).join('\\n');payload.value='';}catch(error){status.className='status bad';status.textContent=error.message||String(error)}finally{button.disabled=false}};
fetch('/api/finances-refresh/status',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(data.live)status.textContent='Current volume snapshot: '+data.lastPull.bankingAsOf+'\\n'+data.files.length+' verified files present.'}).catch(()=>{});
</script></body></html>`;
}

const originalListen = express.application.listen;
express.application.listen = function billsOsLiveFinanceListen() {
  const app = this;

  app.post('/api/finances-refresh', (req, res) => {
    try {
      if (!req.billsosSession || req.billsosSession.role !== 'owner') {
        return res.status(403).json({ error: 'Owner authentication required' });
      }
      const files = validatePayload(req.body);
      const receipt = persistFiles(files, { requireNewer: true });
      return res.status(200).json({
        ok: true,
        storedAt: new Date().toISOString(),
        bankingAsOf: files['spending-last-pull.json'].bankingAsOf,
        files: receipt.files
      });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not persist Finances refresh' });
    }
  });

  app.get('/api/finances-refresh/status', (req, res) => {
    if (!req.billsosSession || req.billsosSession.role !== 'owner') {
      return res.status(403).json({ error: 'Owner authentication required' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json(refreshStatus());
  });

  app.get('/finances-refresh', (req, res) => {
    if (!req.billsosSession || req.billsosSession.role !== 'owner') {
      return res.status(403).send('Owner authentication required');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.send(refreshPage());
  });

  return originalListen.apply(app, arguments);
};

module.exports = { FILES, REFRESH_FILES, LIVE_DIR, validatePayload, persistFiles, refreshStatus, atomicWrite };
