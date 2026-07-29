(function(){
  'use strict';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';
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
  function cleanDates(map){var out={};Object.keys(map||{}).forEach(function(key){var row=map[key]||{};if(/^20\d{2}-\d{2}-\d{2}$/.test(String(row.date||''))){out[key]={date:row.date,originalDate:row.originalDate||String(key).split('|')[0],status:row.status||'moved',updatedAt:row.updatedAt||null}}});return out}
  function signature(map){try{return JSON.stringify(cleanMap(map))}catch(e){return '{}'}}
  function mergeMaps(local,cloud){var out={},keys={};local=cleanMap(local);cloud=cleanMap(cloud);Object.keys(local).forEach(function(k){keys[k]=1});Object.keys(cloud).forEach(function(k){keys[k]=1});Object.keys(keys).forEach(function(k){var l=local[k],c=cloud[k];if(!l)out[k]=c;else if(!c)out[k]=l;else out[k]=timestamp(c)>timestamp(l)?c:l});return out}
  function cloudAmounts(data){var rows=Array.isArray(data&&data.oneTimeEvents)?data.oneTimeEvents:[];var system=rows.find(function(row){return row&&row.id===RULE_ID});return cleanMap(readRules(system).amountAdjustments||{})}
  function markLocalDeletions(current){var next=cleanMap(current),now=new Date().toISOString();Object.keys(lastSnapshot||{}).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(next,key)&&lastSnapshot[key]&&lastSnapshot[key].deleted!==true)next[key]={deleted:true,updatedAt:now}});return next}
  function refreshDashboard(){if(typeof window.BillsOSRecalculateVisibleBalances==='function')window.BillsOSRecalculateVisibleBalances();try{window.dispatchEvent(new CustomEvent('billsos:cloud-sync'))}catch(e){}}

  async function pushCloud(map){if(syncing)return;syncing=true;try{map=cleanMap(map);var response=await fetch('/api/bills?amountSyncPush='+Date.now(),{cache:'no-store'});if(!response.ok)return;var data=await response.json();data=data&&typeof data==='object'?data:{};data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];var index=data.oneTimeEvents.findIndex(function(row){return row&&row.id===RULE_ID});var system=index>=0?data.oneTimeEvents[index]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'};var rules=readRules(system);rules.amountAdjustments=map;system.notes=JSON.stringify(rules);if(index>=0)data.oneTimeEvents[index]=system;else data.oneTimeEvents.push(system);await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});lastSnapshot=cleanMap(map);lastSignature=signature(map)}catch(e){}finally{syncing=false}}

  async function pullCloud(){if(syncing)return;syncing=true;try{var response=await fetch('/api/bills?amountSyncPull='+Date.now(),{cache:'no-store'});if(!response.ok)return;var data=await response.json();var local=cleanMap(readJson(AMOUNT_KEY));var cloud=cloudAmounts(data);var merged=mergeMaps(local,cloud);var localSig=signature(local),cloudSig=signature(cloud),mergedSig=signature(merged);if(mergedSig!==localSig){writeJson(AMOUNT_KEY,merged);refreshDashboard()}lastSnapshot=cleanMap(merged);lastSignature=mergedSig;initialized=true;if(mergedSig!==cloudSig)setTimeout(function(){pushCloud(merged)},150)}catch(e){}finally{syncing=false}}

  async function forceThisDevice(){
    if(syncing)return false;
    syncing=true;
    try{
      var now=new Date().toISOString();
      var amounts=cleanMap(readJson(AMOUNT_KEY));
      var dates=cleanDates(readJson(DATE_KEY));
      Object.keys(amounts).forEach(function(key){amounts[key].updatedAt=now});
      Object.keys(dates).forEach(function(key){dates[key].updatedAt=now});
      writeJson(AMOUNT_KEY,amounts);writeJson(DATE_KEY,dates);
      var response=await fetch('/api/bills?forceDeviceSync='+Date.now(),{cache:'no-store'});if(!response.ok)throw new Error('load');
      var data=await response.json();data=data&&typeof data==='object'?data:{};data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];
      var index=data.oneTimeEvents.findIndex(function(row){return row&&row.id===RULE_ID});
      var system=index>=0?data.oneTimeEvents[index]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'};
      var rules=readRules(system);rules.amountAdjustments=amounts;rules.dateAdjustments=dates;rules.authoritativeDeviceUpdatedAt=now;system.notes=JSON.stringify(rules);
      if(index>=0)data.oneTimeEvents[index]=system;else data.oneTimeEvents.push(system);
      var saved=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!saved.ok)throw new Error('save');
      lastSnapshot=amounts;lastSignature=signature(amounts);initialized=true;refreshDashboard();return true;
    }catch(e){return false}finally{syncing=false}
  }

  function installForceButton(){
    if(document.getElementById('billsosForceSyncButton'))return;
    var host=document.querySelector('.hero-actions,.top-actions,.nav,.tabs')||document.body;
    var button=document.createElement('button');button.id='billsosForceSyncButton';button.type='button';button.textContent='Sync this device';button.title='Make this device’s calendar dates and amounts the cloud source of truth';
    button.style.cssText='border:1px solid rgba(20,35,55,.18);border-radius:999px;background:#fff;color:#14202c;padding:8px 12px;font:inherit;font-size:12px;font-weight:850;cursor:pointer;margin:4px;box-shadow:0 2px 8px rgba(20,35,55,.08)';
    button.addEventListener('click',async function(){if(!window.confirm('Use this device’s current calendar dates and amounts as the version for every device?'))return;button.disabled=true;button.textContent='Syncing…';var ok=await forceThisDevice();button.textContent=ok?'Synced ✓':'Sync failed';setTimeout(function(){button.disabled=false;button.textContent='Sync this device'},2500)});
    host.appendChild(button);
  }

  function watchLocal(){var current=cleanMap(readJson(AMOUNT_KEY));if(!initialized){lastSnapshot=current;lastSignature=signature(current);return}var currentSig=signature(current);if(currentSig===lastSignature)return;var withDeletes=markLocalDeletions(current);writeJson(AMOUNT_KEY,withDeletes);lastSnapshot=cleanMap(withDeletes);lastSignature=signature(withDeletes);pushCloud(withDeletes);refreshDashboard()}
  function schedulePull(delay){clearTimeout(pollTimer);pollTimer=setTimeout(function(){pullCloud()},delay||0)}

  window.BillsOSForceThisDeviceSync=forceThisDevice;
  setInterval(watchLocal,900);
  setInterval(function(){pullCloud()},5000);
  window.addEventListener('pageshow',function(){schedulePull(100);installForceButton()});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)schedulePull(100)});
  window.addEventListener('storage',function(event){if(event.key===AMOUNT_KEY){lastSnapshot=cleanMap(readJson(AMOUNT_KEY));lastSignature=signature(lastSnapshot);refreshDashboard()}schedulePull(100)});
  window.addEventListener('billsos:calendar-change',function(){watchLocal();schedulePull(150)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedulePull(250);installForceButton()});else{schedulePull(250);installForceButton()}
})();