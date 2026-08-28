'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

const SPENDING_PATH = path.join(__dirname, 'spending', 'index.html');

function spendingThemePatch(html) {
  if (html.includes('id="billsosSpendingThemePatch"')) return html;
  const patch = `<style id="billsosSpendingThemePatch">
html[data-billsos-theme="dark"]{--bg:#111418!important;--paper:#1B2025!important;--paper2:#22282D!important;--paper3:#262D32!important;--ink:#F2F4F3!important;--muted:#AEB8B3!important;--line:#30383D!important;--green:#79B98D!important;--purple:#B59BD0!important;--p:#1B2025!important;--p2:#22282D!important;--i:#F2F4F3!important;--m:#AEB8B3!important;--l:#30383D!important;--g:#79B98D!important;--pu:#B59BD0!important;color-scheme:dark}
html[data-billsos-theme="dark"] body{background:#111418!important;color:#F2F4F3!important}html[data-billsos-theme="dark"] .app{color:#F2F4F3!important}
html[data-billsos-theme="dark"] .metric,html[data-billsos-theme="dark"] .runway,html[data-billsos-theme="dark"] .cat,html[data-billsos-theme="dark"] .vendor,html[data-billsos-theme="dark"] .tx{background:#1B2025!important;border-color:#30383D!important;color:#F2F4F3!important}
html[data-billsos-theme="dark"] .sub,html[data-billsos-theme="dark"] .subcategory{background:#22282D!important;border-color:#30383D!important;color:#F2F4F3!important}
html[data-billsos-theme="dark"] .subs,html[data-billsos-theme="dark"] .vendors,html[data-billsos-theme="dark"] .vendor-list,html[data-billsos-theme="dark"] .txwrap{border-color:#30383D!important;background:transparent!important}
html[data-billsos-theme="dark"] .muted,html[data-billsos-theme="dark"] .subtle,html[data-billsos-theme="dark"] .name small,html[data-billsos-theme="dark"] .cname small,html[data-billsos-theme="dark"] .sub small,html[data-billsos-theme="dark"] .subcategory small,html[data-billsos-theme="dark"] .vendor small,html[data-billsos-theme="dark"] .metric span,html[data-billsos-theme="dark"] .r span,html[data-billsos-theme="dark"] .foot,html[data-billsos-theme="dark"] .note,html[data-billsos-theme="dark"] .tx-note,html[data-billsos-theme="dark"] .chev{color:#AEB8B3!important}
html[data-billsos-theme="dark"] .metric small{color:#9BD0AA!important}html[data-billsos-theme="dark"] .r,html[data-billsos-theme="dark"] .row,html[data-billsos-theme="dark"] table,html[data-billsos-theme="dark"] th,html[data-billsos-theme="dark"] td{border-color:#30383D!important}
html[data-billsos-theme="dark"] th{background:#20262A!important;color:#AEB8B3!important}html[data-billsos-theme="dark"] td,html[data-billsos-theme="dark"] .row,html[data-billsos-theme="dark"] .amt{color:#F2F4F3!important}
html[data-billsos-theme="dark"] .status{color:#B9C6BF!important}html[data-billsos-theme="dark"] .pending{color:#E2C27B!important}html[data-billsos-theme="dark"] .refund{color:#9BD0AA!important}html[data-billsos-theme="dark"] .prog{background:#343C41!important}html[data-billsos-theme="dark"] .prog i{background:#B59BD0!important}html[data-billsos-theme="dark"] summary:hover{background:rgba(255,255,255,.025)}
.spending-banking-stamp{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0 2px;color:#526058;font-size:10px;line-height:1.35}.spending-live-dot{width:7px;height:7px;border-radius:50%;background:#39a160;box-shadow:0 0 0 3px rgba(57,161,96,.12)}.spending-freshness-note{color:#7c857f;font-weight:500}html[data-billsos-theme="dark"] .spending-banking-stamp{color:#D7DFDB!important}html[data-billsos-theme="dark"] .spending-freshness-note{color:#9DA9A3!important}
</style>`;
  return html.replace('</head>', patch+'\n</head>');
}

function spendingNavPatch(html) {
  const patch = `<script id="billsosSpendingNavPatch">
(function(){function patchSidebar(){var nav=document.querySelector('.bo-nav');if(!nav)return;var links=[].slice.call(nav.querySelectorAll('a'));var calendar=links.find(function(a){return /Calendar/i.test(a.textContent||'')});var bills=links.find(function(a){return /Bills/i.test(a.textContent||'')});var spending=links.find(function(a){return /Everyday Spending/i.test(a.textContent||'')});if(!spending){spending=document.createElement('a');spending.href='/spending/';spending.target='_self';spending.innerHTML='<span class="bo-icon">◉</span><span>Everyday Spending</span>';if(bills)nav.insertBefore(spending,bills);else if(calendar&&calendar.nextSibling)nav.insertBefore(spending,calendar.nextSibling);else nav.appendChild(spending)}links=[].slice.call(nav.querySelectorAll('a'));links.forEach(function(a){a.classList.remove('is-active')});spending.classList.add('is-active')}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(patchSidebar,0)},{once:true});else setTimeout(patchSidebar,0)})();
</script>`;
  return html.includes('id="billsosSpendingNavPatch"') ? html : html.replace('</body>', patch+'\n</body>');
}

function spendingDataStampPatch(html){
  if(html.includes('/spending-data-stamp.js'))return html;
  return html.replace('</body>','<script defer src="/spending-data-stamp.js?v=20260828b"></script>\n</body>');
}

express.static = function billsOsStatic(root, options) {
  const middleware = originalStatic.call(express, root, options);
  return function billsOsStaticWithSpendingShell(req, res, next) {
    const url = String(req.url || '').split('?')[0];
    if (url === '/spending/' || url === '/spending/index.html') {
      try {
        let html = fs.readFileSync(SPENDING_PATH, 'utf8');
        html = spendingThemePatch(spendingDataStampPatch(spendingNavPatch(html)));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).send(html);
      } catch (err) { return next(err); }
    }
    return middleware(req, res, next);
  };
};
