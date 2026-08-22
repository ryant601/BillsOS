(function(){
  'use strict';
  var DATE_KEY='billsos-pay-adjust-v1';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DONE_KEY='billsos-generated-done-v5';
  var RULE_ID='__billsos_system_rules__';
  var initialized=false,suppress=false,dirty=false,pushing=false,pushTimer=0,pullTimer=0,lastRevision=0;

  function readJson(key){try{var v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(e){return {}}}
  function writeJson(key,value){suppress=true;try{localStorage.setItem(key,JSON.stringify(value||{}))}catch(e){}suppress=false}
  function localState(){return {dateAdjustments:readJson(DATE_KEY),amountAdjustments:readJson(AMOUNT_KEY),completed:readJson(DONE_KEY)}}
  function readRules(row){try{return JSON.parse(row&&row.notes||'{}')||{}}catch(e){return {}}}
  function clean(s){s=s&&typeof s==='object'?s:{};return {dateAdjustments:s.dateAdjustments&&typeof s.dateAdjustments==='object'?s.dateAdjustments:{},amountAdjustments:s.amountAdjustments&&typeof s.amountAdjustments==='object'?s.amountAdjustments:{},completed:s.completed&&typeof s.completed==='object'?s.completed:{},updatedAt:s.updatedAt||null,revision:Number(s.revision||0)}}
  function cloudState(data){var rows=Array.isArray(data&&data.oneTimeEvents)?data.oneTimeEvents:[],sys=rows.find(function(x){return x&&x.id===RULE_ID}),rules=readRules(sys);return clean(rules.calendarState||{dateAdjustments:rules.dateAdjustments||{},amountAdjustments:rules.amountAdjustments||{},completed:rules.completed||{},revision:Number(data&&data.revision||0)})}
  function same(a,b){try{return JSON.stringify(a||{})===JSON.stringify(b||{})}catch(e){return false}}
  function setStatus(text){var el=document.getElementById('billsosSyncStatus');if(el)el.textContent=text}
  function applyCloud(next,reload){var before=localState();writeJson(DATE_KEY,next.dateAdjustments);writeJson(AMOUNT_KEY,next.amountAdjustments);writeJson(DONE_KEY,next.completed);var changed=!same(before,localState());if(changed&&reload&&document.querySelector('.month-panel,.cal'))setTimeout(function(){location.reload()},80);return changed}
  async function fetchBills(tag){var r=await fetch('/api/bills?syncv2='+encodeURIComponent(tag||'pull')+'&t='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  async function postState(next,keepalive){
    if(pushing){dirty=true;return false}
    pushing=true;setStatus('Syncing…');
    try{
      var r=await fetch('/api/bills/calendar-state',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:!!keepalive,body:JSON.stringify({baseRevision:lastRevision,calendarState:clean(next)})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json(),remote=cloudState(data);
      lastRevision=remote.revision;
      dirty=false;
      applyCloud(remote,false);
      setStatus('Up to date · rev '+lastRevision);
      return true;
    }catch(e){
      dirty=true;
      setStatus('Sync unavailable');
      return false;
    }finally{pushing=false}
  }
  function schedulePush(){if(!initialized||suppress)return;dirty=true;setStatus('Saving…');clearTimeout(pushTimer);pushTimer=setTimeout(function(){postState(localState(),false)},80)}
  async function reconcile(initial){
    if(pushing)return;
    if(dirty){await postState(localState(),false);return}
    try{
      var data=await fetchBills(initial?'initial':'pull'),remote=cloudState(data);
      lastRevision=Math.max(lastRevision,remote.revision);
      var changed=applyCloud(remote,!initial);
      initialized=true;
      setStatus(lastRevision?'Up to date · rev '+lastRevision:'Up to date');
      if(changed&&initial&&document.querySelector('.month-panel,.cal'))setTimeout(function(){location.reload()},80)
    }catch(e){initialized=true;setStatus('Offline')}
  }
  function installStorageGuard(){if(window.__billsosSyncV2Guard)return;window.__billsosSyncV2Guard=true;var original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){var result=original.apply(this,arguments);if(this===localStorage&&!suppress&&(key===DATE_KEY||key===AMOUNT_KEY||key===DONE_KEY))schedulePush();return result}}
  function start(){installStorageGuard();reconcile(true);clearInterval(pullTimer);pullTimer=setInterval(function(){if(!document.hidden)reconcile(false)},8000)}
  window.BillsOSForceThisDeviceSync=function(){if(!initialized)return Promise.resolve(false);dirty=true;return postState(localState(),false)};
  window.addEventListener('focus',function(){setTimeout(function(){reconcile(false)},80)});
  window.addEventListener('pagehide',function(){if(dirty)postState(localState(),true)});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(function(){reconcile(false)},80)});
  window.addEventListener('pageshow',function(){setTimeout(function(){reconcile(false)},100)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
