'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Control Center owns the navy dark theme', () => {
  const html = read('control.html');
  const css = read('control-theme.css');
  const server = read('server.js');

  assert.match(html, /<body class="billsos-control">/);
  assert.match(css, /html\[data-billsos-theme="dark"\] body\.billsos-control/);
  assert.match(css, /\.btn\.primary\{[\s\S]*background:#7D9FD2!important/);
  assert.match(css, /input,[\s\S]*background:#1f283a!important/);
  assert.match(css, /\.tablewrap,[\s\S]*background:#252F42!important/);
  assert.match(css, /outline:2px solid #7D9FD2!important/);
  assert.doesNotMatch(css, /body\.billsos-control[\s\S]{0,300}#f0b47e/i);
  assert.match(server, /control-theme\.css\?v=20261001navy1/);
});
