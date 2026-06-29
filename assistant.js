(function(){
  'use strict';
  var BUILD='billsos-bootstrap-20260629-1';
  var VERSION='20260629split1';
  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.bootstrap={loaded:true,build:BUILD,at:new Date().toISOString(),modules:[]};
  function loadModule(src,name){
    try{
      var script=document.createElement('script');
      script.src=src+'?v='+VERSION;
      script.defer=true;
      script.onload=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:true,at:new Date().toISOString()});};
      script.onerror=function(){window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:'load failed',at:new Date().toISOString()});};
      document.head.appendChild(script);
    }catch(e){
      window.BillsOSModules.bootstrap.modules.push({name:name,loaded:false,error:String(e&&e.message||e),at:new Date().toISOString()});
    }
  }
  function init(){
    loadModule('/mobile-ui.js','mobile-ui');
    loadModule('/dashboard-sync.js','dashboard-sync');
    loadModule('/assistant-ui.js','assistant-ui');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
