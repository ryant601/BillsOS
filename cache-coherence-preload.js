'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const BUILD = '20260929paymentplanner2';
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
  'billsos-v2-ui.js',
  'assistant-calendar-consistency.js',
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

function ensureAssistantConsistency(html, isDashboard) {
  if (!isDashboard || html.includes('id="billsosAssistantCalendarConsistency"')) return html;
  const tag = '<script id="billsosAssistantCalendarConsistency" defer src="/assistant-calendar-consistency.js?v=' + BUILD + '"></script>';
  return html.replace('</body>', tag + '\n</body>');
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

function ensureSpendingSidebar(html) {
  if (html.includes('id="billsosSpendingSidebarLink"')) return html;
  const script = `<script id="billsosSpendingSidebarLink">
(function(){
  function install(){
    var nav=document.querySelector('.bo-nav');
    if(!nav)return false;
    var existing=nav.querySelector('a[href="/spending/"]');
    if(!existing){
      var calendar=nav.querySelector('a[href="/?view=calendar"]');
      var bills=nav.querySelector('a[href="/control#bills"]');
      var a=document.createElement('a');
      a.href='/spending/';
      a.target='_self';
      a.innerHTML='<span class="bo-icon">$</span><span>Everyday Spending</span>';
      if(bills)nav.insertBefore(a,bills);else if(calendar&&calendar.nextSibling)nav.insertBefore(a,calendar.nextSibling);else nav.appendChild(a);
      existing=a;
    }
    var onSpending=location.pathname.indexOf('/spending')===0;
    if(onSpending){
      nav.querySelectorAll('a').forEach(function(link){link.classList.remove('is-active')});
      existing.classList.add('is-active');
    }
    return true;
  }
  function boot(){if(install())return;var tries=0,t=setInterval(function(){tries++;if(install()||tries>40)clearInterval(t)},50)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;
  return html.replace('</body>', script + '\n</body>');
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
  updated = ensureAssistantConsistency(updated, isDashboard);
  updated = ensureIncome14Day(updated, isDashboard);
  updated = removeLegacySpendingHeaderLink(updated, isDashboard);
  updated = ensureSpendingSidebar(updated);
  return Buffer.isBuffer(result) ? Buffer.from(updated, 'utf8') : updated;
};
