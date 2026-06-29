(function(){
  'use strict';
  var BUILD='billsos-bootstrap-20260629-2';
  var VERSION='20260629split2';
  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.bootstrap={loaded:true,build:BUILD,at:new Date().toISOString(),modules:[]};

  function addFallbackStyle(){
    if(document.getElementById('billsos-bootstrap-fallback-style'))return;
    var style=document.createElement('style');
    style.id='billsos-bootstrap-fallback-style';
    style.textContent=[
      '.toggle{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important}',
      '.toggle .tabs{display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;gap:8px!important}',
      '.toggle .tabs button{flex:0 0 auto!important;white-space:nowrap!important}',
      '.billsos-bootstrap-fab{position:fixed!important;right:14px!important;bottom:14px!important;z-index:2147483647!important;border:0!important;border-radius:999px!important;background:#14202c!important;color:#fff!important;padding:13px 16px!important;box-shadow:0 16px 38px rgba(20,35,55,.32)!important;font:800 13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;display:flex!important;gap:9px!important;align-items:center!important;cursor:pointer!important}',
      '.billsos-bootstrap-dot{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:999px!important;background:rgba(255,255,255,.16)!important}',
      '.billsos-bootstrap-sheet{position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:2147483646!important;background:#fff!important;border-radius:22px 22px 0 0!important;box-shadow:0 -18px 60px rgba(20,35,55,.25)!important;border:1px solid rgba(20,35,55,.14)!important;display:none!important;overflow:hidden!important}',
      '.billsos-bootstrap-sheet.open{display:block!important}',
      '.billsos-bootstrap-head{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:13px 14px!important;border-bottom:1px solid rgba(20,35,55,.1)!important;font:800 14px system-ui!important;color:#14202c!important}',
      '.billsos-bootstrap-close{border:1px solid rgba(20,35,55,.12)!important;background:#fff!important;border-radius:999px!important;width:30px!important;height:30px!important;font-size:18px!important;color:#41505f!important}',
      '.billsos-bootstrap-body{padding:14px!important;background:#f8fafc!important;color:#14202c!important;font:500 13px/1.45 system-ui!important}',
      '.billsos-bootstrap-build{position:fixed!important;left:8px!important;bottom:8px!important;z-index:2147483647!important;background:rgba(20,32,44,.78)!important;color:#fff!important;border-radius:999px!important;padding:4px 7px!important;font:700 10px system-ui!important;opacity:.7!important}',
      '@media(min-width:761px){.billsos-bootstrap-sheet{left:auto!important;right:14px!important;bottom:80px!important;width:420px!important;border-radius:22px!important}.billsos-bootstrap-fab{bottom:18px!important;right:18px!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function makeFallback(){
    if(document.getElementById('billsosBootstrapFab')||document.getElementById('billsosAiFab'))return;
    var sheet=document.createElement('section');
    sheet.id='billsosBootstrapSheet';
    sheet.className='billsos-bootstrap-sheet';
    sheet.innerHTML='<div class="billsos-bootstrap-head"><span>BillsOS Assistant</span><button class="billsos-bootstrap-close" id="billsosBootstrapClose" type="button">×</button></div><div class="billsos-bootstrap-body"><b>Bootstrap loaded.</b><br>The assistant shell is running directly from assistant.js. Module status is available in <code>window.BillsOSModules</code>.</div>';
    var fab=document.createElement('button');
    fab.id='billsosBootstrapFab';
    fab.className='billsos-bootstrap-fab';
    fab.type='button';
    fab.innerHTML='<span class="billsos-bootstrap-dot">💬</span><span>Ask BillsOS</span>';
    var build=document.createElement('div');
    build.className='billsos-bootstrap-build';
    build.textContent=BUILD;
    document.body.appendChild(sheet);
    document.body.appendChild(fab);
    document.body.appendChild(build);
    fab.onclick=function(){sheet.classList.toggle('open');};
    document.getElementById('billsosBootstrapClose').onclick=function(){sheet.classList.remove('open');};
  }

  function loadModule(src,name){
    try{
      var script=document.createElement('script');
      script.src=src+'?v='+VERSION;
      script.async=false;
      script.onload=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:true,at:new Date().toISOString()});};
      script.onerror=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:'load failed',at:new Date().toISOString()});};
      document.head.appendChild(script);
    }catch(e){
      window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:String(e&&e.message||e),at:new Date().toISOString()});
    }
  }

  function init(){
    addFallbackStyle();
    makeFallback();
    loadModule('/mobile-ui.js','mobile-ui');
    loadModule('/dashboard-sync.js','dashboard-sync');
    loadModule('/assistant-ui.js','assistant-ui');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
