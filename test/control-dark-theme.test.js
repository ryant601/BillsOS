'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Control Center owns a neutral dark theme instead of the shared amber palette', () => {
  const html = read('control.html');
  const css = read('control-theme.css');
  const server = read('server.js');

  assert.match(html, /<body class="billsos-control">/);
  assert.match(css, /html\[data-billsos-theme="dark"\] body\.billsos-control/);
  assert.match(css, /\.tab\.active,[\s\S]*background:#39724F!important/);
  assert.match(css, /input,[\s\S]*background:#15191D!important/);
  assert.match(css, /\.tablewrap,[\s\S]*background:#1B2025!important/);
  assert.match(css, /outline:2px solid #79B98D!important/);
  assert.doesNotMatch(css, /body\.billsos-control[\s\S]{0,300}#f0b47e/i);
  assert.match(server, /control-theme\.css\?v=20260825controldark1/);
});
