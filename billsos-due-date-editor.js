(function(){
  'use strict';
  var PAY_KEY='billsos-pay-adjust-v1';
  var RULE_ID='__billsos_system_rules__';
  var RELOAD_KEY='billsos-due-date-reload-v1';
  var lastKey=null;
  var syncing=false;
  var lastSignature='';

  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function clean(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function originalDate(key){var d=String(key||'').split('|')[0]||'';return validDate(d)?d:''}
  function dateLabel(v){if(!validDate(v))return '—';var d=new Date(v+'T12:00:00');return d.toLocaleDateString([], {month:'short',day:'numeric'})}
  function isDashboard(){return location.pathname==='/'||location.pathname.indexOf('/generated')===0}
  function readMap(){try{var parsed=JSON.parse(localStorage.getItem(PAY_KEY)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(e){return {}}}
  function cleanMap(map){var out={};Object.keys(map||{}).forEach(function(k){var row=map[k]||{},date=row.date,orig=row.originalDate||originalDate(k);if(validDate(date)&&validDate(orig)){out[k]={date:date,originalDate:orig,status:row.status||'moved',updatedAt:row.updatedAt||null}}});return out}
  function saveMap(map){try{localStorage.setItem(PAY_KEY,JSON.stringify(map||{}))}catch(e){}}
  function sig(map){try{return JSON.stringify(cleanMap(map||{}))}catch(e){return '{}'}}
  function hash(s){var h=0,i,chr;for(i=0;i<s.length;i++){chr=s.charCodeAt(i);h=((h<<5)-h)+chr;h|=0}return String(h)}
  function currentDateFor(key){var map=readMap(),row=map[key]||{};return validDate(row.date)?row.date:originalDate(key)}
  function isMoved(key){var row=readMap()[key]||{};return validDate(row.date)&&row.date!==originalDate(key)}
  function saveDueDate(key,date){
    if(!key||!validDate(date))return false;
    var orig=originalDate(key);if(!orig)return false;
    var map=readMap();
    if(date===orig)delete map[key];
    else{var existing=map[key]||{};map[key]={date:date,originalDate:orig,status:existing.status||'moved',updatedAt:new Date().toISOString()}}
    saveMap(map);
    lastSignature=sig(map);
    pushCloud(map);
    return true;
  }
  function resetDueDate(key){if(!key)return false;var map=readMap();if(!map[key])return false;delete map[key];saveMap(map);lastSignature=sig(map);pushCloud(map);return true}
  function requestReload(){
    if(!isDashboard())return;
    var marker=hash(sig(readMap()));
    try{sessionStorage.setItem(RELOAD_KEY,marker)}catch(e){}
    setTimeout(function(){location.reload()},220);
  }
  function readRules(row){try{return JSON.parse(row&&row.notes||'{}')||{}}catch(e){return {}}}
  function cloudDates(data){var row=(data.oneTimeEvents||[]).find(function(x){return x&&x.id===RULE_ID}),rules=readRules(row);return cleanMap(rules.dateAdjustments||{})}
  function mergeMaps(local,cloud){var out={},keys={};local=cleanMap(local);cloud=cleanMap(cloud);Object.keys(local).forEach(function(k){keys[k]=1});Object.keys(cloud).forEach(function(k){keys[k]=1});Object.keys(keys).forEach(function(k){var l=local[k],c=cloud[k];if(!l)out[k]=c;else if(!c)out[k]=l;else{var lt=Date.parse(l.updatedAt||'')||0,ct=Date.parse(c.updatedAt||'')||0;out[k]=ct>lt?c:l}});return out}
  async function pullCloud(){
    try{
      var response=await fetch('/api/bills?dueDatePull='+Date.now(),{cache:'no-store'});if(!response.ok)return;
      var data=await response.json(),local=readMap(),cloud=cloudDates(data),merged=mergeMaps(local,cloud),localSig=sig(local),cloudSig=sig(cloud),mergedSig=sig(merged);
      if(mergedSig!==localSig){saveMap(merged);lastSignature=mergedSig;if(isDashboard()){var h=hash(mergedSig);if(sessionStorage.getItem(RELOAD_KEY)!==h){sessionStorage.setItem(RELOAD_KEY,h);setTimeout(function(){location.reload()},260)}}}
      if(mergedSig!==cloudSig)setTimeout(function(){pushCloud(merged)},250);
    }catch(e){}
  }
  async function pushCloud(map){
    if(syncing)return;
    syncing=true;
    try{
      map=cleanMap(map||readMap());
      var response=await fetch('/api/bills?dueDatePush='+Date.now(),{cache:'no-store'});if(!response.ok)return;
      var data=await response.json();data=data&&typeof data==='object'?data:{};data.oneTimeEvents=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[];
      var idx=data.oneTimeEvents.findIndex(function(x){return x&&x.id===RULE_ID});
      var row=idx>=0?data.oneTimeEvents[idx]:{id:RULE_ID,name:'BillsOS system rules',type:'meta',amount:0,date:null,notes:'{}'};
      var rules=readRules(row);rules.dateAdjustments=map;row.notes=JSON.stringify(rules);
      if(idx>=0)data.oneTimeEvents[idx]=row;else data.oneTimeEvents.push(row);
      await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    }catch(e){}finally{syncing=false}
  }
  function watchLocal(){lastSignature=sig(readMap());setInterval(function(){var current=sig(readMap());if(current!==lastSignature){lastSignature=current;pushCloud(readMap())}},1200)}
  function ensureStyle(){
    if(document.getElementById('billsosDueDateEditorStyle'))return;
    var style=document.createElement('style');
    style.id='billsosDueDateEditorStyle';
    style.textContent='.amountEditPopover .dueDateBlock{display:grid;gap:6px}.amountEditPopover .dueDateHelp{font-size:11px;line-height:1.35;color:#5f6b7a}.amountEditPopover button.dueReset{grid-column:1 / -1;color:#475569;background:#f8fafc;border-color:rgba(20,35,55,.14)}html[data-billsos-theme="dark"] .amountEditPopover button.dueReset{background:#111827;color:#e5e7eb;border-color:rgba(226,232,240,.16)}';
    document.head.appendChild(style);
  }
  function injectDueDate(popover,key){
    if(!popover||!key||popover.dataset.dueDateEditor==='1')return;
    var orig=originalDate(key);if(!orig)return;
    ensureStyle();
    popover.dataset.dueDateEditor='1';
    popover.dataset.amountKey=key;
    var amountInput=popover.querySelector('input');
    var block=document.createElement('div');
    block.className='dueDateBlock';
    block.innerHTML='<label>Due date</label><input class="dueDateEditInput" type="date" value="'+clean(currentDateFor(key))+'" min="2026-01-01" max="2026-12-31"><div class="dueDateHelp">Original due date: '+clean(dateLabel(orig))+'</div>'+(isMoved(key)?'<button type="button" class="dueReset" data-action="reset-due-date">Reset due date</button>':'');
    if(amountInput&&amountInput.parentNode===popover)amountInput.insertAdjacentElement('afterend',block);else popover.insertBefore(block,popover.firstChild);
  }
  function activePopover(){return document.querySelector('.amountEditPopover')}
  function syncPopover(){var pop=activePopover();if(pop&&lastKey)injectDueDate(pop,lastKey)}

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest&&event.target.closest('.amountEditBtn,.amountEditable');
    if(target&&target.dataset&&target.dataset.amountKey){lastKey=target.dataset.amountKey;setTimeout(syncPopover,0);setTimeout(syncPopover,80)}
  },true);
  document.addEventListener('click',function(event){
    var pop=event.target&&event.target.closest&&event.target.closest('.amountEditPopover');
    if(!pop)return;
    var action=event.target&&event.target.getAttribute&&event.target.getAttribute('data-action');
    var key=pop.dataset.amountKey||lastKey;
    if(action==='reset-due-date'){
      event.preventDefault();event.stopPropagation();
      if(resetDueDate(key))requestReload();
      return;
    }
    if(action==='save'){
      var input=pop.querySelector('.dueDateEditInput');
      if(input&&key&&validDate(input.value)&&input.value!==currentDateFor(key)){
        saveDueDate(key,input.value);
        requestReload();
      }
    }
  },true);
  document.addEventListener('focusin',function(event){if(event.target&&event.target.classList&&event.target.classList.contains('dueDateEditInput'))event.target.select&&event.target.select()},true);

  try{new MutationObserver(syncPopover).observe(document.documentElement,{subtree:true,childList:true})}catch(e){}
  watchLocal();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(pullCloud,500);setTimeout(pullCloud,1400)});else{setTimeout(pullCloud,500);setTimeout(pullCloud,1400)}
  setInterval(pullCloud,15000);
})();
