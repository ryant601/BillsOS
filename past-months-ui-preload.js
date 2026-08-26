'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const BUILD = '20260826-past-months-1';

fs.readFileSync = function pastMonthsUiReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  if (!isText || !name.endsWith('generated-v5.html')) return result;

  const html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  if (html.includes('id="billsosPastMonthsUi"')) return result;

  const style = '<style id="billsosPastMonthsUiStyle">.billsos-past-month-hidden{display:none!important}.past-months-toggle{flex:0 0 auto;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:9px 14px;font-weight:900;color:var(--primary);cursor:pointer;min-height:42px;white-space:nowrap}.past-months-toggle[aria-pressed="true"]{background:#fbf7ef}</style>';
  const script = '<script id="billsosPastMonthsUi" defer src="/past-months-ui.js?v=' + BUILD + '"></script>';
  const updated = html.replace('</head>', style + '\n</head>').replace('</body>', script + '\n</body>');
  return Buffer.isBuffer(result) ? Buffer.from(updated, 'utf8') : updated;
};
