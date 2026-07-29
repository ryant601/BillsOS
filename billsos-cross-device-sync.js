(function(){
  'use strict';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var RULE_ID='__billsos_system_rules__';
  var initialized=false;
  var syncing=false;
  var lastSnapshot={};
  var lastSignature='';
  var pollTimer=0;

  function readJson(key){try{var value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch(e){return {}}}
  function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value||{}))}catch(e){}}
  function readRules(row){try{return JSON.parse(row&&row.notes||'{}')||{}}catch(e){return {}}}
  function timestamp(row){return Date.parse(row&&row.updatedAt||'')||0}
  function cleanMap(map){var out={};Object.keys(map||{}).forEach(function(key){var row=map[key]||{};if(row.deleted===true){out[key]={deleted:true,updatedAt:row.updatedAt||null};return}var amount=Number(row.amount);if(isFinite(amount)&&amount>=0)out[key]={amount:Math.round(amount*100)/100,updatedAt:row.updatedAt||null}});return out}
  function signature(map){try{return JSON.stringify(cleanMap(map))}catch(e){return '{}'}}
  function mergeMaps(local,cloud){var out={},keys={};local=cleanMap(local);cloud=cleanMap(cloud);Object.keys(local).forEach(function(k){keys[k]=1});Object.keys(cloud).forEach(function(k){keys[k]=1});Object.keys(keys).forEach(function(k){var l=local[k],c=cloud[k];if(!l)out[k]=c;else if(!c)out[k]=l;else out[k]=timestamp(c)>timestamp(l)?c:l});return out}
  function cloudAmounts(data){var rows=Array.isArray(data&&data.oneTimeEvents)?data.oneTimeEvents:[];var system=rows.find(function(row){return row&&row.id===RULE_ID});return cleanMap(readRules(system).amountAdjustments||{})}
  function markLocalDeletions(current){var next=cleanMap(current),now=new Date().toISOString();Object.keys(lastSnapshot||{}).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(next,key)&&lastSnapshot[key]&&lastSnapshot[key].deleted!==true)next[key]={deleted:true,updatedAt:now}});return next}
  function refreshDashboard(){if(typeof window.BillsOSRecalculateVisibleBalances==='function')window.BillsOSRecalculateVisibleBalances();try{window.dispatchEvent(new CustomEvent('billsos:cloud-sync'))}catch(e){}}

  async function pushCloud(map){if(syncing)return;syncing=true;try{map=cleanMap(map);var response=await fetch('/api/bills?amountSyncPush='+Date.now(),{cache:'no-store'});if(!response.ok)return;var data=await response.json();data=data&&typeof data==='object'?data:{};data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];var index=data.oneTimeEvents.findIndex(function(row){return row&&row.id===RULE_ID});var system=index>=0?data.oneTimeEvents[index]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'};var rules=readRules(system);rules.amountAdjustments=map;system.notes=JSON.stringify(rules);if(index>=0)data.oneTimeEvents[index]=system;else data.oneTimeEvents.push(system);await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});lastSnapshot=cleanMap(map);lastSignature=signature(map)}catch(e){}finally{syncing=false}}

  async function pullCloud(){if(syncing)return;syncing=true;try{var response=await fetch('/api/bills?amountSyncPull='+Date.now(),{cache:'no-store'});if(!response.ok)return;var data=await response.json();var local=cleanMap(readJson(AMOUNT_KEY));var cloud=cloudAmounts(data);var merged=mergeMaps(local,cloud);var localSig=signature(local),cloudSig=signature(cloud),mergedSig=signature(merged);if(mergedSig!==localSig){writeJson(AMOUNT_KEY,merged);refreshDashboard()}lastSnapshot=cleanMap(merged);lastSignature=mergedSig;initialized=true;if(mergedSig!==cloudSig)setTimeout(function(){pushCloud(merged)},150)}catch(e){}finally{syncing=false}}

  function watchLocal(){var current=cleanMap(readJson(AMOUNT_KEY));if(!initialized){lastSnapshot=current;lastSignature=signature(current);return}var currentSig=signature(current);if(currentSig===lastSignature)return;var withDeletes=markLocalDeletions(current);writeJson(AMOUNT_KEY,withDeletes);lastSnapshot=cleanMap(withDeletes);lastSignature=signature(withDeletes);pushCloud(withDeletes);refreshDashboard()}
  function schedulePull(delay){clearTimeout(pollTimer);pollTimer=setTimeout(function(){pullCloud()},delay||0)}

  setInterval(watchLocal,900);
  setInterval(function(){pullCloud()},5000);
  window.addEventListener('pageshow',function(){schedulePull(100)});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)schedulePull(100)});
  window.addEventListener('storage',function(event){if(event.key===AMOUNT_KEY){lastSnapshot=cleanMap(readJson(AMOUNT_KEY));lastSignature=signature(lastSnapshot);refreshDashboard()}schedulePull(100)});
  window.addEventListener('billsos:calendar-change',function(){watchLocal();schedulePull(150)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedulePull(250)});else schedulePull(250);
})();