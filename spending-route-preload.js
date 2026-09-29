'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

const SPENDING_PATH = path.join(__dirname, 'spending', 'index.html');
const SPENDING_BUILD = '20260928categorysave1';

function spendingRunwayPatch(html) {
  if (html.includes('/spending-runway.js')) return html;
  return html.replace('</head>', '<script src="/spending-runway.js?v=' + SPENDING_BUILD + '"></script>\n</head>');
}

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
.spending-refresh-notice{margin:10px 0;padding:10px 12px;border:1px solid #a96e27;border-radius:10px;background:#fff3df;color:#593811;font-size:12px;line-height:1.4}html[data-billsos-theme="dark"] .spending-refresh-notice{background:#34291c;color:#f1d5ac;border-color:#9a723c}
body.bo-spending h2.section{margin:32px 2px 12px;font-family:Newsreader,'Iowan Old Style',Georgia,serif;font-size:28px;font-weight:500;letter-spacing:-.02em}
body.bo-spending #cats{display:grid;gap:10px;min-width:0}
body.bo-spending .cat{margin:0!important;border-radius:14px!important;overflow:hidden!important}
body.bo-spending .cat>summary{display:grid!important;grid-template-columns:minmax(0,1fr) auto 22px!important;column-gap:12px!important;align-items:center!important;padding:14px 16px!important;min-width:0!important}
body.bo-spending .cat>summary:has(.ico){grid-template-columns:40px minmax(0,1fr) auto 22px!important}
body.bo-spending .cat>summary .ico{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:color-mix(in srgb,var(--accent,#c15f3c) 18%,#fff);font-size:20px;line-height:1}
body.bo-spending .cat>summary .name{min-width:0;overflow:hidden;font-size:15px;font-weight:600}
body.bo-spending .cat>summary .name small{display:block;margin-top:3px;font-size:11px;font-weight:500;color:var(--muted,#6b6a63)}
body.bo-spending .cat>summary>b{font-size:18px!important;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap;justify-self:end}
body.bo-spending .cat>summary .chev,body.bo-spending .cat>summary>span:last-child{justify-self:center;color:var(--muted,#6b6a63);font-size:16px;line-height:1}