(function(){
  'use strict';
  var DATE_KEY='billsos-pay-adjust-v1';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DONE_KEY='billsos-generated-done-v5';
  var RULE_ID='__billsos_system_rules__';
  var RECENT_LOCAL_MS=6*60*60*1000;
  var initialized=false,suppress=false,dirty=false,pushing=false,pushTimer=0,pullTimer=0,lastRevision=0;

  function readJson(key){try{var v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(e){return {}}}
  function writeJson(key,value){suppress=true;try{localStorage.setItem(key,JSON.stringify(value||{}))}catch(e){}suppress=false}
  function state(){return {dateAdjustments:readJson(DATE_KEY),amountAdjustments:readJson(AMOUNT_KEY),completed:readJson(DONE_KEY)}}
  function readRules(row){try{return JSON.parse(row&&row.notes||'{}')||{}}catch(e){return {}}}
  function clean(s){s=s&&typeof s==='object'?s:{};return {dateAdjustments:s.dateAdjustments&&typeof s.dateAdjustments==='object'?s.dateAdjustments:{},amountAdjustments:s.amountAdjustments&&typeof s.amountAdjustments==='object'?s.amountAdjustments:{},completed:s.completed&&typeof s.completed==='object'?s.completed:{},updatedAt:s.updatedAt||null,revision:Number(s.revision||0)}}
  function cloudState(data){var rows=Array.isArray(data&&data.oneTimeEvents)?data.oneTimeEvents:[],sys=rows.find(function(x){return x&&x.id===RULE_ID}),rules=readRules(sys);return {system:sys,rules:rules,state:clean(rules.calendarState||{dateAdjustments:rules.dateAdjustments||{},amountAdjustments:rules.amountAdjustments||{},completed:rules.completed||{},revision:1})}}
  function stamp(x){var t=Date.parse(x&&x.updatedAt||'');return isFinite(t)?t:0}
  function same(a,b){try{return JSON.stringify(a||{})===JSON.stringify(b||{})}catch(e){return false}}
  function mergeTimed(local,remote){var out={},keys={};Object.keys(remote||{}).forEach(function(k){keys[k]=1});Object.keys(local||{}).forEach(function(k){keys[k]=1});Object.keys(keys).forEach(function(k){var l=local&&local[k],r=remote&&remote[k];if(l&&r){out[k]=stamp(l)>=stamp(r)?l:r;return}if(r){out[k]=r;return}if(l&&stamp(l)&&Date.now()-stamp(l)<=RECENT_LOCAL_MS)out[k]=l});return out}
  function setStatus(text){var el=document.getElementById('billsosSyncStatus');if(el)el.textContent=text}
  function applyLocal(next,reload){var before=state();writeJson(DATE_KEY,next.dateAdjustments);writeJson(AMOUNT_KEY,next.amountAdjustments);writeJson(DONE_KEY,next.completed);var changed=!same(before,state());if(changed&&reload&&document.querySelector('.month-panel,.cal'))setTimeout(function(){location.reload()},80);return changed}
  async function fetchBills(tag){var r=await fetch('/api/bills?syncv2='+encodeURIComponent(tag||'pull')+'&t='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
  async function postState(next){if(pushing)return false;pushing=true;setStatus('Syncing…');try{var data=await fetchBills('push'),parts=cloudState(data),rows=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[],idx=rows.findIndex(function(x){return x&&x.id===RULE_ID}),sys=idx>=0?rows[idx]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'},rules=readRules(sys),prev=clean(rules.calendarState||{}),payload=clean(next);payload.updatedAt=new Date().toISOString();payload.revision=Math.max(prev.revision,lastRevision)+1;rules.calendarState=payload;rules.dateAdjustments=payload.dateAdjustments;rules.amountAdjustments=payload.amountAdjustments;rules.completed=payload.completed;sys.notes=JSON.stringify(rules);sys.updatedAt=payload.updatedAt;if(idx>=0)rows[idx]=sys;else rows.push(sys);data.oneTimeEvents=rows;var saved=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(data)});if(!saved.ok)throw new Error('HTTP '+saved.status);lastRevision=payload.revision;dirty=false;setStatus('Up to date · rev '+lastRevision);return true}catch(e){setStatus('Sync unavailable');return false}finally{pushing=false}}
  function schedulePush(){if(!initialized||suppress)return;dirty=true;setStatus('Saving…');clearTimeout(pushTimer);pushTimer=setTimeout(function(){postState(state())},120)}
  async function reconcile(initial){if(pushing)return;try{var data=await fetchBills(initial?'initial':'pull'),parts=cloudState(data),remote=parts.state,local=state();lastRevision=Math.max(lastRevision,remote.revision);if(dirty){await postState(local);return}var merged={dateAdjustments:mergeTimed(local.dateAdjustments,remote.dateAdjustments),amountAdjustments:mergeTimed(local.amountAdjustments,remote.amountAdjustments),completed:remote.completed&&Object.keys(remote.completed).length?remote.completed:local.completed};var localContributed=!same(merged.dateAdjustments,remote.dateAdjustments)||!same(merged.amountAdjustments,remote.amountAdjustments);var changed=applyLocal(merged,!initial);initialized=true;if(localContributed){dirty=true;await postState(merged)}else setStatus(lastRevision?'Up to date · rev '+lastRevision:'Up to date');if(changed&&initial&&document.querySelector('.month-panel,.cal'))setTimeout(function(){location.reload()},80)}catch(e){initialized=true;setStatus('Offline')}}
  function installStorageGuard(){if(window.__billsosSyncV2Guard)return;window.__billsosSyncV2Guard=true;var original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){var result=original.apply(this,arguments);if(this===localStorage&&!suppress&&(key===DATE_KEY||key===AMOUNT_KEY||key===DONE_KEY))schedulePush();return result}}
  function start(){installStorageGuard();reconcile(true);clearInterval(pullTimer);pullTimer=setInterval(function(){if(!document.hidden)reconcile(false)},8000)}
  window.BillsOSForceThisDeviceSync=function(){initialized=true;dirty=true;return postState(state())};
  window.addEventListener('focus',function(){setTimeout(function(){reconcile(false)},80)});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)setTimeout(function(){reconcile(false)},80)});
  window.addEventListener('pageshow',function(){setTimeout(function(){reconcile(false)},100)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
