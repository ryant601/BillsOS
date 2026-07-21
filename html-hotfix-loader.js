'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  if (!name.endsWith('generated-v5.html') || (encoding && encoding !== 'utf8' && encoding !== 'utf-8')) return result;

  const html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  if (html.includes('/amount-balance-hotfix.js')) return result;
  return html.replace('</body>', '<script defer src="/amount-balance-hotfix.js?v=20260721amountbalance1"></script></body>');
};
