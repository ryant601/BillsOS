'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

const SPENDING_PATH = path.join(__dirname, 'spending', 'index.html');
const SPENDING_BUILD = '20260901txdatasource1';

function spendingThemePatch(html) {
  if (html.includes('id="billsosSpendingThemePatch"')) return html;
  const patch = `<style id="billsosSpendingThemePatch">
html[data-billsos-theme="dark"]{--bg:#1f1e1d!important;--paper:#30302e!important;--paper2:#3a3a37!important;--paper3:#45453f!important;--ink:#f5f4ef!important;--muted:#b3b0a8!important;--line:#3d3d3a!important;--green:#7fbf9a!important;--purple:#d97757!important;--p:#30302e!important;--p2:#3a3a37!important;--i:#f5f4ef!important;--m:#b3b0a8!important;--l:#3d3d3a!important;--g:#7fbf9a!important;--pu:#d97757!important;color-scheme:dark}
body.bo-app.bo-spending{padding-left:224px!important}body.bo-app.bo-spending>.app,body.bo-app.bo-spending .shell>.app{width:100%;min-width:0;margin-left:auto!important;margin-right:auto!important}body.bo-app.bo-spending .shell{display:block!important}body.bo-app.bo-spending .shell>.side,body.bo-app.bo-spending aside.side{display:none!important}@media(max-width:760px){body.bo-app.bo-spending{padding-left:0!important}}
html[data-billsos-theme="dark"] body{background:#1f1e1d!important;color:#f5f4ef!important}html[data-billsos-theme="dark"] .app{color:#f5f4ef!important}
html[data-billsos-theme="dark"] .metric,html[data-billsos-theme="dark"] .runway,html[data-billsos-theme="dark"] .cat,html[data-billsos-theme="dark"] .vendor,html[data-billsos-theme="dark"] .tx{background:#30302e!important;border-color:#3d3d3a!important;color:#f5f4ef!important}
html[data-billsos-theme="dark"] .sub,html[data-billsos-theme="dark"] .subcategory{background:#3a3a37!important;border-color:#3d3d3a!important;color:#f5f4ef!important}
html[data-billsos-theme="dark"] .subs,html[data-billsos-theme="dark"] .vendors,html[data-billsos-theme="dark"] .vendor-list,html[data-billsos-theme="dark"] .txwrap{border-color:#3d3d3a!important;background:transparent!important}
html[data-billsos-theme="dark"] .muted,html[data-billsos-theme="dark"] .subtle,html[data-billsos-theme="dark"] .name small,html[data-billsos-theme="dark"] .cname small,html[data-billsos-theme="dark"] .sub small,html[data-billsos-theme="dark"] .subcategory small,html[data-billsos-theme="dark"] .vendor small,html[data-billsos-theme="dark"] .metric span,html[data-billsos-theme="dark"] .r span,html[data-billsos-theme="dark"] .foot,html[data-billsos-theme="dark"] .note,html[data-billsos-theme="dark"] .tx-note,html[data-billsos-theme="dark"] .chev{color:#b3b0a8!important}
html[data-billsos-theme="dark"] .metric small{color:#7fbf9a!important}html[data-billsos-theme="dark"] .r,html[data-billsos-theme="dark"] .row,html[data-billsos-theme="dark"] table,html[data-billsos-theme="dark"] th,html[data-billsos-theme="dark"] td{border-color:#3d3d3a!important}
html[data-billsos-theme="dark"] th{background:#3a3a37!important;color:#b3b0a8!important}html[data-billsos-theme="dark"] td,html[data-billsos-theme="dark"] .row,html[data-billsos-theme="dark"] .amt{color:#f5f4ef!important}
html[data-billsos-theme="dark"] .status{color:#b3b0a8!important}html[data-billsos-theme="dark"] .pending{color:#d9b478!important}html[data-billsos-theme="dark"] .refund{color:#7fbf9a!important}html[data-billsos-theme="dark"] .prog{background:#45453f!important}html[data-billsos-theme="dark"] .prog i{background:#d97757!important}html[data-billsos-theme="dark"] summary:hover{background:rgba(255,255,255,.025)}
.spending-banking-stamp{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0 2px;color:#6b6a63;font-size:10px;line-height:1.35}.spending-live-dot{width:7px;height:7px;border-radius:50%;background:#2c6446;box-shadow:0 0 0 3px rgba(44,100,70,.12)}.spending-freshness-note{color:#8e8c84;font-weight:500}html[data-billsos-theme="dark"] .spending-banking-stamp{color:#e2e0d8!important}html[data-billsos-theme="dark"] .spending-freshness-note{color:#918e86!important}
</style>`;
  return html.replace('</head>', patch+'\n</head>');
}

function spendingLayoutPatch(html) {
  html = String(html || '').replace(/<aside class="side">[\s\S]*?<\/aside>/i, '');
  return html.replace(/<body\b([^>]*)>/i, function(match, attrs) {
    const classMatch = attrs.match(/\bclass=(['"])(.*?)\1/i);
    if (classMatch) {
      if (/(?:^|\s)bo-spending(?:\s|$)/.test(classMatch[2])) return match;
      return match.replace(classMatch[0], 'class=' + classMatch[1] + classMatch[2] + ' bo-spending' + classMatch[1]);
    }
    return '<body' + attrs + ' class="bo-spending">';
  });
}

function spendingNavPatch(html) {
  const patch = `<script id="billsosSpendingNavPatch">
(function(){function patchSidebar(){var nav=document.querySelector('.bo-nav');if(!nav)return;var links=[].slice.call(nav.querySelectorAll('a'));var calendar=links.find(function(a){return /Calendar/i.test(a.textContent||'')});var bills=links.find(function(a){return /Bills/i.test(a.textContent||'')});var spending=links.find(function(a){return /Everyday Spending/i.test(a.textContent||'')});if(!spending){spending=document.createElement('a');spending.href='/spending/';spending.target='_self';spending.innerHTML='<span class="bo-icon">◉</span><span>Everyday Spending</span>';if(bills)nav.insertBefore(spending,bills);else if(calendar&&calendar.nextSibling)nav.insertBefore(spending,calendar.nextSibling);else nav.appendChild(spending)}links=[].slice.call(nav.querySelectorAll('a'));links.forEach(function(a){a.classList.remove('is-active')});spending.classList.add('is-active')}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(patchSidebar,0)},{once:true});else setTimeout(patchSidebar,0)})();
</script>`;
  return html.includes('id="billsosSpendingNavPatch"') ? html : html.replace('</body>', patch+'\n</body>');
}

function spendingDataStampPatch(html){
  if(html.includes('/spending-data-stamp.js'))return html;
  return html.replace('</body>','<script defer src="/spending-data-stamp.js?v='+SPENDING_BUILD+'"></script>\n</body>');
}

function spendingHistoryPatch(html){
  if(html.includes('/spending-history.js'))return html;
  return html.replace('</body>','<script defer src="/spending-history.js?v='+SPENDING_BUILD+'"></script>\n</body>');
}

function spendingAssistantPatch(html){
  if(html.includes('/spending-assistant.js'))return html;
  return html.replace('</body>','<script defer src="/spending-assistant.js?v='+SPENDING_BUILD+'"></script>\n</body>');
}

function spendingTransactionRecategorizePatch(html){
  if(html.includes('/spending-transaction-recategorize.js'))return html;
  return html.replace('</body>','<script defer src="/spending-transaction-recategorize.js?v='+SPENDING_BUILD+'"></script>\n</body>');
}

function serveSpendingHtml(filePath, includeLiveStamp, res, next){
  try {
    let html = fs.readFileSync(filePath, 'utf8');
    html = spendingLayoutPatch(html);
    html = spendingNavPatch(spendingHistoryPatch(spendingAssistantPatch(spendingTransactionRecategorizePatch(html))));
    if(includeLiveStamp) html = spendingDataStampPatch(html);
    html = spendingThemePatch(html);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (err) { return next(err); }
}

express.static = function billsOsStatic(root, options) {
  const middleware = originalStatic.call(express, root, options);
  return function billsOsStaticWithSpendingShell(req, res, next) {
    const url = String(req.url || '').split('?')[0];
    if (url === '/spending/' || url === '/spending/index.html') {
      return serveSpendingHtml(SPENDING_PATH, true, res, next);
    }
    const archiveMatch = url.match(/^\/spending\/archive\/(\d{4}-\d{2}-\d{2})\/?(?:index\.html)?$/);
    if (archiveMatch) {
      const archivePath = path.join(__dirname, 'spending', 'archive', archiveMatch[1], 'index.html');
      return serveSpendingHtml(archivePath, false, res, next);
    }
    return middleware(req, res, next);
  };
};

module.exports.spendingLayoutPatch = spendingLayoutPatch;
module.exports.spendingThemePatch = spendingThemePatch;
