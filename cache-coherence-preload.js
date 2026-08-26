'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const BUILD = '20260826fy2027a';
const CRITICAL_ASSETS = [
  'billsos-cross-device-sync-v2.js',
  'billsos-sidebar-calculator.js',
  'amount-balance-hotfix.js',
  'billsos-balance-editor.js',
  'cashflow-engine.js',
  'billsos-week-toggle.js',
  'day-details-enhance.js',
  'billsos-v2-ui.js',
  'assistant-calendar-consistency.js'
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

function ensureAssistantConsistency(html, isDashboard) {
  if (!isDashboard || html.includes('id="billsosAssistantCalendarConsistency"')) return html;
  const tag = '<script id="billsosAssistantCalendarConsistency" defer src="/assistant-calendar-consistency.js?v=' + BUILD + '"></script>';
  return html.replace('</body>', tag + '\n</body>');
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
  const updated = ensureAssistantConsistency(forceVersion(html), isDashboard);
  return Buffer.isBuffer(result) ? Buffer.from(updated, 'utf8') : updated;
};
