'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const BUILD = '20260819splitpayments1';
const CRITICAL_ASSETS = [
  'billsos-cross-device-sync.js',
  'billsos-sidebar-calculator.js',
  'amount-balance-hotfix.js',
  'billsos-balance-editor.js',
  'cashflow-engine.js',
  'billsos-week-toggle.js'
];

function forceVersion(html) {
  CRITICAL_ASSETS.forEach(function (asset) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(/' + escaped + ')(?:\\?[^"\\\']*)?', 'g');
    html = html.replace(re, '$1?v=' + BUILD);
  });
  return html;
}

fs.readFileSync = function coherentReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  const isHtml = name.endsWith('generated-v5.html') || name.endsWith('control.html') || name.endsWith('index.html');
  if (!isText || !isHtml) return result;
  const html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  const updated = forceVersion(html);
  return Buffer.isBuffer(result) ? Buffer.from(updated, 'utf8') : updated;
};
