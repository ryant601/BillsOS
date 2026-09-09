(function(){
  'use strict';

  function isArchive(){return location.pathname.indexOf('/spending/archive/')===0 && location.pathname!=='/spending/archive/';}
  function currentLabel(){return isArchive() ? 'Archived report' : 'Current cycle';}
  function installStyle(){
    if(document.getElementById('spendingHistoryStyle'))return;
    var s=document.createElement('style');s.id='spendingHistoryStyle';s.textContent='\n.spending-history{margin:14px 0 2px;background:var(--p,#fffdf9);border:1px solid var(--l,#ddd5c9);border-radius:16px;padding:10px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.spending-history-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:var(--m,#77736d)}.spending-history-current{font-size:11px;font-weight:850;color:var(--i,#17372f)}.spending-history select{margin-left:auto;min-width:190px;max-width:100%;border:1px solid var(--l,#ddd5c9);background:var(--p2,#f8f4ed);color:var(--i,#17372f);border-radius:999px;padding:8px 30px 8px 11px;font:inherit;font-size:10px;font-weight:800}.spending-history-note{font-size:9px;color:var(--m,#77736d)}html[data-billsos-theme="dark"] .spending-history{background:#1B2025!important;border-color:#30383D!important}html[data-billsos-theme="dark"] .spending-history-label,html[data-billsos-theme="dark"] .spending-history-note{color:#AEB8B3!important}html[data-billsos-theme="dark"] .spending-history-current{color:#F2F4F3!important}html[data-billsos-theme="dark"] .spending-history select{background:#22282D!important;border-color:#3A4449!important;color:#F2F4F3!important;color-scheme:dark}@media(max-width:560px){.spending-history select{width:100%;margin-left:0}}';
    document.head.appendChild(s);
  }
  function installEmojiControls(){
    if(isArchive()||document.getElementById('billsosSpendingCategoryEmojiScript'))return;
    var script=document.createElement('script');script.id='billsosSpendingCategoryEmojiScript';script.defer=true;script.src='/spending-category-emoji.js?v=20260909emoji1';document.head.appendChild(script);
  }
  function install(data){
    if(document.getElementById('spendingHistory'))return;
    installStyle();
    var anchor=document.querySelector('.spending-banking-stamp') || document.querySelector('.muted,.subtle');
    if(!anchor)return;
    var box=document.createElement('div');box.id='spendingHistory';box.className='spending-history';
    var label=document.createElement('span');label.className='spending-history-label';label.textContent='Reports';
    var cur=document.createElement('span');cur.className='spending-history-current';cur.textContent=currentLabel();
    var select=document.createElement('select');select.setAttribute('aria-label','Everyday Spending report');
    var o=document.createElement('option');o.value='/spending/';o.textContent='Current cycle';select.appendChild(o);
    var reports=(data&&Array.isArray(data.reports))?data.reports:[];
    reports.forEach(function(r){var opt=document.createElement('option');opt.value=r.path;opt.textContent=r.label || ((r.start||'')+' – '+(r.end||''));select.appendChild(opt)});
    var here=location.pathname.replace(/index\.html$/,'');
    [].slice.call(select.options).forEach(function(opt){var p=String(opt.value||'').replace(/index\.html$/,'');if(p===here)opt.selected=true});
    select.addEventListener('change',function(){if(select.value)location.href=select.value});
    box.appendChild(label);box.appendChild(cur);box.appendChild(select);
    if(!reports.length){var note=document.createElement('span');note.className='spending-history-note';note.textContent='Previous two-week reports will appear here after the first rollover.';box.appendChild(note)}
    anchor.insertAdjacentElement('afterend',box);
  }
  installEmojiControls();
  fetch('/spending/archive/manifest.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{reports:[]}}).then(install).catch(function(){install({reports:[]})});
})();
