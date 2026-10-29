'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const BUILD = '20261029syncpreserve1';
const CRITICAL_ASSETS = [
  'billsos-cross-device-sync-v2.js',
  'billsos-sidebar-calculator.js',
  'amount-balance-hotfix.js',
  'billsos-balance-editor.js',
  'calendar-payment-split.js',
  'billsos-card-editor.js',
  'calendar-list-view.js',
  'calendar-list-view.css',
  'negative-balance-recommendations.js',
  'negative-balance-recommendations.css',
  'cashflow-engine.js',
  'action-log.js',
  'assistant.js',
  'access-control-ui.js',
  'billsos-v2-ui.js',
  'income-14day-home.js'
];

function forceVersion(html) {
  html = html.replace(/\/billsos-cross-device-sync\.js(?:\?[^"']*)?/g, '/billsos-cross-device-sync-v2.js?v=' + BUILD);
  CRITICAL_ASSETS.forEach(function (asset) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(/' + escaped + ')(?:\\?[^"\\\']*)?', 'g');
    html = html.replace(re, '$1?v=' + BUILD);
  });
  return html;
}

function ensureIncome14Day(html, isDashboard) {
  if (!isDashboard || html.includes('id="billsosIncome14DayHome"')) return html;
  const tag = '<script id="billsosIncome14DayHome" defer src="/income-14day-home.js?v=' + BUILD + '"></script>';
  return html.replace('</body>', tag + '\n</body>');
}

function removeLegacySpendingHeaderLink(html, isDashboard) {
  if (!isDashboard) return html;
  return html.replace(/<a href="\/spending\/">Everyday Spending<\/a>/g, '');
}

fs.readFileSync = function coherentReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  const isDashboard = name.endsWith('generated-v5.html');
  const isHtml = isDashboard || name.endsWith('control.html') || name.endsWith('index.html');
  if (!isText || !isHtml) return result;
  const html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  let updated = forceVersion(html);
  updated = ensureIncome14Day(updated, isDashboard);
  updated = removeLegacySpendingHeaderLink(updated, isDashboard);
  return Buffer.isBuffer(result) ? Buffer.from(updated, 'utf8') : updated;
};
