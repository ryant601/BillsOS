(function(){
  'use strict';
  var BUILD='mobile-ui-20260629-1';
  window.BillsOSModules=window.BillsOSModules||{};
  function addStyle(){
    if(document.getElementById('billsos-mobile-ui-style'))return;
    var style=document.createElement('style');
    style.id='billsos-mobile-ui-style';
    style.textContent='body{overflow-x:hidden!important}.toggle{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important;scrollbar-width:none!important}.toggle::-webkit-scrollbar{display:none!important}.toggle .tabs{display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;gap:8px!important}.toggle .tabs button{flex:0 0 auto!important;white-space:nowrap!important}.wrap{max-width:100%!important}@media(max-width:760px){.wrap{padding-left:8px!important;padding-right:8px!important;padding-bottom:92px!important}.toggle{margin-left:-2px!important;margin-right:-2px!important}.toggle .tabs button{min-width:82px!important}}';
    document.head.appendChild(style);
  }
  function init(){
    try{addStyle();window.BillsOSModules.mobile={loaded:true,build:BUILD,at:new Date().toISOString()};}
    catch(e){window.BillsOSModules.mobile={loaded:false,error:String(e&&e.message||e),build:BUILD};}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
