'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createAccessControl, COOKIE_NAME } = require('../access-control');

test('retired assistant routes are gone and the authenticated dashboard still works', async () => {
  const root = path.join(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billsos-no-ask-'));
  const env = { ...process.env, PORT: '0', BILLS_DATA_DIR: dir,
    BILLS_READONLY_FILE: path.join(dir, 'readonly.json'), BILLS_OWNER_USERNAME: 'owner',
    BILLS_OWNER_PASSWORD: 'test-password', BILLS_SESSION_SECRET: 'test-session' };
  const listener = path.join(dir, 'listener.cjs');
  fs.writeFileSync(listener, `const http=require('node:http');const listen=http.Server.prototype.listen;http.Server.prototype.listen=function(){const s=listen.apply(this,arguments);s.on('listening',()=>console.log('TEST_PORT='+s.address().port));return s};`);
  const child = spawn(process.execPath, ['-r', listener, '-r', './html-hotfix-loader.js', '-r', './cache-coherence-preload.js', 'server.js'], { cwd: root, env });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
      child.on('error', reject);
      child.on('exit', code => { clearTimeout(timer); reject(new Error('Server exited ' + code)); });
      child.stdout.on('data', chunk => { const match = String(chunk).match(/TEST_PORT=(\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    const base = 'http://127.0.0.1:' + port;
    for (const route of ['/api/assistant', '/api/assistant/intent', '/api/assistant/status', '/api/assistant/test', '/assistant.html', '/assistant-ui.js', '/assistant-ai-bridge.js']) {
      const response = await fetch(base + route, { method: route.startsWith('/api/') ? 'POST' : 'GET' });
      assert.equal(response.status, 410, route);
    }
    const access = createAccessControl(env);
    const cookie = COOKIE_NAME + '=' + access.createSession(access.authenticate('owner', 'test-password'));
    const response = await fetch(base + '/', { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.doesNotMatch(html, /src=["'][^"']*assistant-(?:ui|ai-bridge|calendar-consistency)\.js/);
    assert.match(html, /negative-balance-recommendations/);
    assert.equal((await fetch(base + '/api/bills', { headers: { Cookie: cookie } })).status, 200);
  } finally { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});
