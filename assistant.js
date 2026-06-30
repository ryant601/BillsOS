(function(){
  'use strict';
  var BUILD='billsos-state-sync-20260629-1';
  var VERSION='20260629state1';
  var LOCAL_COMPLETED='billsos-completed-events-v1';
  var cloudCompleted=null;
  var isApplying=false;

  window.BillsOSModules=window.BillsOSModules||{};
  window.BillsOSModules.bootstrap={loaded:true,build:BUILD,at:new Date().toISOString(),modules:[]};

  function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function readLocalCompleted(){try{return JSON.parse(localStorage.getItem(LOCAL_COMPLETED)||'{}')||{};}catch(e){return {};}}
  function writeLocalCompleted(completed){try{localStorage.setItem(LOCAL_COMPLETED,JSON.stringify(completed||{}));}catch(e){}}
  function eventIdFromElement(ev){
    var day=ev.closest('.day');
    var panel=ev.closest('.month-panel');
    var month=panel&&panel.id?panel.id.replace('panel-',''):'month';
    var d=day?day.getAttribute('data-day'):'x';
    var nm=cleanText((ev.querySelector('.nm')||{}).textContent||'');
    var amt=cleanText((ev.querySelector('.amt')||{}).textContent||'');
    return month+'|'+d+'|'+nm+'|'+amt;
  }
  function collectCompletedFromDom(){
    var completed={};
    document.querySelectorAll('.month-panel .ev').forEach(function(ev){
      if(ev.classList.contains('in')||ev.classList.contains('note'))return;
      var box=ev.querySelector('input[type="checkbox"]');
      if(box&&box.checked)completed[eventIdFromElement(ev)]=1;
    });
    return completed;
  }
  function updatePanelProgress(panel){
    var billEvents=[].slice.call(panel.querySelectorAll('.ev')).filter(function(ev){return !ev.classList.contains('in')&&!ev.classList.contains('note');});
    var total=billEvents.length;
    var paid=billEvents.filter(function(ev){return ev.classList.contains('done');}).length;
    var pc=panel.querySelector('.paidCount');
    var pt=panel.querySelector('.paidTotal');
    var bar=panel.querySelector('.paidBar');
    var st=panel.querySelector('.saveStatus,.savestatus');
    if(pc)pc.textContent=paid;
    if(pt)pt.textContent=total;
    if(bar)bar.style.width=total?Math.round((paid/total)*100)+'%':'0%';
    if(st){st.textContent='Synced';st.className=(st.className||'')+' ok';}
  }
  function applyCompleted(completed){
    if(!completed)return;
    isApplying=true;
    document.querySelectorAll('.month-panel .ev').forEach(function(ev){
      if(ev.classList.contains('in')||ev.classList.contains('note'))return;
      var box=ev.querySelector('input[type="checkbox"]');
      if(!box)return;
      var checked=!!completed[eventIdFromElement(ev)];
      box.checked=checked;
      ev.classList.toggle('done',checked);
    });
    document.querySelectorAll('.month-panel').forEach(updatePanelProgress);
    isApplying=false;
  }
  async function saveCloud(completed){
    writeLocalCompleted(completed);
    cloudCompleted=completed;
    try{
      await fetch('/api/checkmarks',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:completed})});
    }catch(e){
      window.BillsOSModules.checkmarkSync={loaded:false,build:BUILD,error:String(e&&e.message||e),at:new Date().toISOString()};
    }
  }
  async function loadCloud(){
    var local=readLocalCompleted();
    try{
      var response=await fetch('/api/checkmarks',{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      var data=await response.json();
      var remote=(data&&data.completed&&typeof data.completed==='object')?data.completed:{};
      var remoteEmpty=!Object.keys(remote).length;
      var localKeys=Object.keys(local);
      cloudCompleted=remoteEmpty&&localKeys.length?local:remote;
      writeLocalCompleted(cloudCompleted);
      if(remoteEmpty&&localKeys.length)saveCloud(cloudCompleted);
      applyCompleted(cloudCompleted);
      window.BillsOSModules.checkmarkSync={loaded:true,build:BUILD,updatedAt:data&&data.updatedAt||null,at:new Date().toISOString()};
    }catch(e){
      cloudCompleted=local;
      applyCompleted(cloudCompleted);
      window.BillsOSModules.checkmarkSync={loaded:false,build:BUILD,error:String(e&&e.message||e),fallback:'localStorage',at:new Date().toISOString()};
    }
  }
  function scheduleApply(){
    if(cloudCompleted)applyCompleted(cloudCompleted);
  }
  function bindCheckboxSync(){
    document.addEventListener('change',function(event){
      var target=event.target;
      if(isApplying||!target||!target.matches||!target.matches('.month-panel .ev input[type="checkbox"]'))return;
      setTimeout(function(){saveCloud(collectCompletedFromDom());},0);
    },true);
  }
  function addFallbackStyle(){
    if(document.getElementById('billsos-bootstrap-fallback-style'))return;
    var style=document.createElement('style');
    style.id='billsos-bootstrap-fallback-style';
    style.textContent='.toggle{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;white-space:nowrap!important}.toggle .tabs{display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;gap:8px!important}.toggle .tabs button{flex:0 0 auto!important;white-space:nowrap!important}';
    document.head.appendChild(style);
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
    bindCheckboxSync();
    loadCloud();
    var target=document.getElementById('month-panels')||document.body;
    new MutationObserver(function(){scheduleApply();}).observe(target,{childList:true,subtree:true});
    setInterval(function(){loadCloud();},30000);
    loadModule('/mobile-ui.js','mobile-ui');
    loadModule('/dashboard-sync.js','dashboard-sync');
    loadModule('/assistant-ui.js','assistant-ui');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
