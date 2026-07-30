'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  if (!name.endsWith('generated-v5.html') || (encoding && encoding !== 'utf8' && encoding !== 'utf-8')) return result;

  let html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  const scripts = [
    '<script defer src="/amount-balance-hotfix.js?v=20260728calendartruth4"></script>',
    '<script defer src="/billsos-cross-device-sync.js?v=20260730localfirst1"></script>'
  ];
  scripts.forEach((script) => {
    const src = script.match(/src="([^"]+)/)[1].split('?')[0];
    const existing = new RegExp('<script[^>]+src=["\\\']' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
    if (existing.test(html)) html = html.replace(existing, script);
    else html = html.replace('</body>', script + '</body>');
  });
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};