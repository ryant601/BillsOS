'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

function upsertScript(html, script) {
  const match = script.match(/src="([^"]+)/);
  if (!match) return html;
  const src = match[1].split('?')[0];
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp('<script[^>]+src=["\\\']' + escaped + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
  if (existing.test(html)) return html.replace(existing, script);
  return html.replace('</body>', script + '\n</body>');
}

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  if (!isText || !name.endsWith('generated-v5.html')) return result;

  let html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  html = upsertScript(html, '<script defer src="/amount-balance-hotfix.js?v=20260728calendartruth4"></script>');
  html = upsertScript(html, '<script defer src="/billsos-cross-device-sync.js?v=20260730localfirst1"></script>');
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};
