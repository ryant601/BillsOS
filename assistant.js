(function(){
  'use strict';
  var BUILD='assistant-ios-loader-20260629-1';
  function addStyle(){
    if(document.getElementById('billsos-assistant-style'))return;
    var s=document.createElement('style');
    s.id='billsos-assistant-style';
    s.textContent=[
      '.toggle{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important}',
      '.toggle .tabs{display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;gap:8px!important}',
      '.toggle .tabs button{flex:0 0 auto!important;white-space:nowrap!important}',
      '.billsos-ai-fab{position:fixed!important;right:16px!important;bottom:18px!important;z-index:2147483647!important;border:0!important;border-radius:999px!important;background:#14202c!important;color:#fff!important;padding:13px 16px!important;box-shadow:0 16px 38px rgba(20,35,55,.32)!important;font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;display:flex!important;gap:9px!important;align-items:center!important;cursor:pointer!important}',
      '.billsos-ai-dot{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;background:rgba(255,255,255,.16)!important}',
      '.billsos-ai-sheet{position:fixed!important;right:16px!important;bottom:82px!important;width:min(420px,calc(100vw - 32px))!important;max-height:70vh!important;z-index:2147483646!important;background:#fff!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:22px!important;box-shadow:0 24px 70px rgba(20,35,55,.28)!important;display:none!important;overflow:hidden!important}',
      '.billsos-ai-sheet.open{display:block!important}',
      '.billsos-ai-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:13px 14px!important;border-bottom:1px solid rgba(20,35,55,.1)!important;font:800 14px system-ui!important;color:#14202c!important}',
      '.billsos-ai-close{border:1px solid rgba(20,35,55,.12)!important;background:#fff!important;border-radius:999px!important;width:30px!important;height:30px!important;font-size:18px!important;color:#41505f!important}',
      '.billsos-ai-content{padding:14px!important;background:#f8fafc!important;color:#14202c!important;font:500 13px/1.4 system-ui!important}',
      '.billsos-ai-content input{box-sizing:border-box!important;width:100%!important;border:1px solid rgba(20,35,55,.16)!important;border-radius:999px!important;padding:11px 12px!important;margin-top:10px!important;font-size:14px!important}',
      '.billsos-build-pill{position:fixed!important;left:10px!important;bottom:10px!important;z-index:2147483647!important;background:rgba(20,32,44,.82)!important;color:#fff!important;border-radius:999px!important;padding:5px 8px!important;font:700 10px system-ui!important;opacity:.65!important}',
      '@media(max-width:760px){.billsos-ai-sheet{left:0!important;right:0!important;bottom:0!important;width:auto!important;max-height:78vh!important;border-radius:22px 22px 0 0!important}.billsos-ai-fab{right:14px!important;bottom:14px!important}.wrap{padding-bottom:86px!important}}'
    ].join('');
    document.head.appendChild(s);
  }
  function makeBubble(){
    if(document.getElementById('billsosAiFab'))return;
    var sheet=document.createElement('section');
    sheet.id='billsosAiSheet';
    sheet.className='billsos-ai-sheet';
    sheet.innerHTML='<div class="billsos-ai-head"><span>BillsOS Assistant</span><button class="billsos-ai-close" id="billsosAiClose" type="button">×</button></div><div class="billsos-ai-content"><b>Assistant loaded.</b><br>Ask timing, affordability, upcoming bill, and low-balance questions here. Rich answers come next after this loader is verified on iOS.<input id="billsosAiInput" placeholder="Ask BillsOS…"></div>';
    var fab=document.createElement('button');
    fab.id='billsosAiFab';
    fab.className='billsos-ai-fab';
    fab.type='button';
    fab.innerHTML='<span class="billsos-ai-dot">💬</span><span>Ask BillsOS</span>';
    var pill=document.createElement('div');
    pill.className='billsos-build-pill';
    pill.textContent=BUILD;
    document.body.appendChild(sheet);
    document.body.appendChild(fab);
    document.body.appendChild(pill);
    fab.onclick=function(){sheet.classList.toggle('open');};
    document.getElementById('billsosAiClose').onclick=function(){sheet.classList.remove('open');};
  }
  function init(){
    window.BillsOSAssistantLoaded=BUILD;
    addStyle();
    makeBubble();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
