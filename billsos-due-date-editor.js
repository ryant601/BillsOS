(function(){
  'use strict';
  var PAY_KEY='billsos-pay-adjust-v1';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var RULE_ID='__billsos_system_rules__';
  var RELOAD_KEY='billsos-due-date-reload-v1';
  var lastKey=null;
  var syncing=false;
  var lastSignature='';
  var restoreTimer=0;

  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function clean(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function originalDate(key){var d=String(key||'').split('|')[0]||'';return validDate(d)?d:''}
  function dateLabel(v){if(!validDate(v))return '—';var d=new Date(v+'T12:00:00');return d.toLocaleDateString([], {month:'short',day:'numeric'})}
  function isDashboard(){return location.pathname==='/'||location.pathname.indexOf('/generated')===0}
  function parseMoney(v){var n=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function moneyCents(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function amountFromKey(key){var parts=String(key||'').split('|'),n=Number(parts[parts.length-1]);return isFinite(n)?n:0}
  function readJson(key){try{var parsed=JSON.parse(localStorage.getItem(key)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(e){return {}}}
  function writeJson(key,map){try{localStorage.setItem(key,JSON.stringify(map||{}))}catch(e){}}
  function readMap(){return readJson(PAY_KEY)}
  function saveMap(map){writeJson(PAY_KEY,map)}
  function readAmountMap(){return readJson(AMOUNT_KEY)}
  function saveAmountMap(map){writeJson(AMOUNT_KEY,map)}
  function cleanMap(map){var out={};Object.keys(map||{}).forEach(function(k){var row=map[k]||{},date=row.date,orig=row.originalDate||originalDate(k);if(validDate(date)&&validDate(orig)){out[k]={date:date,originalDate:orig,status:row.status||'moved',updatedAt:row.updatedAt||null}}});return out}
  function sig(map){try{return JSON.stringify(cleanMap(map||{}))}catch(e){return '{}'}}
  function hash(s){var h=0,i,chr;for(i=0;i<s.length;i++){chr=s.charCodeAt(i);h=((h<<5)-h)+chr;h|=0}return String(h)}
  function currentDateFor(key){var map=readMap(),row=map[key]||{};return validDate(row.date)?row.date:originalDate(key)}
  function isMoved(key){var row=readMap()[key]||{};return validDate(row.date)&&row.date!==originalDate(key)}
  function adjustedAmountFor(key){var base=Math.abs(amountFromKey(key)),edit=readAmountMap()[key];return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function hasAmountAdjustment(key){var edit=readAmountMap()[key];return !!(edit&&isFinite(Number(edit.amount)))}
  function saveAmountAdjustment(key,amount){if(!key)return false;var cleanAmount=Math.round(Math.abs(Number(amount||0))*100)/100;if(!isFinite(cleanAmount)||cleanAmount<0)return false;var base=Math.abs(amountFromKey(key)),map=readAmountMap();if(Math.abs(cleanAmount-base)<0.005)delete map[key];else map[key]={amount:cleanAmount,updatedAt:new Date().toISOString()};saveAmountMap(map);return true}
  function clearAmountAdjustment(key){var map=readAmountMap();if(map[key]){delete map[key];saveAmountMap(map);return true}return false}
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
    style.textContent='.amountEditPopover .dueDateBlock{display:grid;gap:6px}.amountEditPopover .dueDateHelp{font-size:11px;line-height:1.35;color:#5f6b7a}.amountEditPopover button.dueReset{grid-column:1 / -1;color:#475569;background:#f8fafc;border-color:rgba(20,35,55,.14)}.billsosEditRestoreBtn{border:1px solid rgba(20,35,55,.14);background:rgba(255,255,255,.74);color:inherit;border-radius:8px;padding:4px 7px;font:inherit;font-size:9px;font-weight:850;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;box-shadow:none}.billsosEditRestoreBtn:hover,.billsosEditRestoreBtn:focus{background:#fff;border-color:rgba(31,58,61,.34);outline:none}.ev.amount-edited .billsosEditRestoreBtn,.detailItem.amount-edited .amt{box-shadow:0 0 0 2px rgba(168,101,26,.13);border-color:rgba(168,101,26,.35)!important}.amountEditPopover .billsosDateRow{display:grid;gap:6px}.amountEditPopover .billsosEditError{font-size:11px;color:#9f1239;font-weight:800}.detailItem .amt.amountEditable{cursor:pointer;border:1px solid rgba(20,35,55,.12);border-radius:999px;padding:4px 7px;background:rgba(255,255,255,.72)}html[data-billsos-theme="dark"] .amountEditPopover button.dueReset{background:#111827;color:#e5e7eb;border-color:rgba(226,232,240,.16)}html[data-billsos-theme="dark"] .billsosEditRestoreBtn{background:rgba(15,23,42,.65);border-color:rgba(226,232,240,.18)}html[data-billsos-theme="dark"] .detailItem .amt.amountEditable{background:rgba(15,23,42,.65);border-color:rgba(226,232,240,.18)}';
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
  function labelFor(key){var due=currentDateFor(key);return moneyCents(adjustedAmountFor(key))+(validDate(due)?'  ·  '+dateLabel(due):'')}
  function findRowName(row){var span=row&&row.querySelector&&row.querySelector(':scope > span');return text(span)||'Bill'}
  function recalcSoon(){setTimeout(function(){if(typeof window.BillsOSRecalculateVisibleBalances==='function')window.BillsOSRecalculateVisibleBalances()},80);setTimeout(syncRestoredEditors,120)}
  function saveAllFromPopover(pop,key){var amountInput=pop.querySelector('.billsosAmountEditInput')||pop.querySelector('input[inputmode="decimal"]')||pop.querySelector('input');var dateInput=pop.querySelector('.dueDateEditInput');var error=pop.querySelector('.billsosEditError');var amount=parseMoney(amountInput&&amountInput.value);if(!isFinite(amount)||amount<0){if(error)error.textContent='Enter a valid amount.';return}var amountOk=saveAmountAdjustment(key,amount);var dateChanged=false;if(dateInput&&validDate(dateInput.value)&&dateInput.value!==currentDateFor(key)){dateChanged=saveDueDate(key,dateInput.value)}if(!amountOk){if(error)error.textContent='Amount could not be saved.';return}closeRestoredPopover();syncRestoredEditors();recalcSoon();if(dateChanged)requestReload()}
  function closeRestoredPopover(){var existing=document.querySelector('.amountEditPopover[data-billsos-restored="1"]');if(existing)existing.remove()}
  function openRestoredEditor(key,anchor){
    if(!key||!anchor)return;
    closeRestoredPopover();
    ensureStyle();
    lastKey=key;
    var base=Math.abs(amountFromKey(key));
    var pop=document.createElement('div');
    pop.className='amountEditPopover';
    pop.dataset.billsosRestored='1';
    pop.dataset.amountKey=key;
    pop.innerHTML='<label>Amount</label><input class="billsosAmountEditInput" inputmode="decimal" autocomplete="off" value="'+clean(adjustedAmountFor(key).toFixed(2))+'"><div class="billsosDateRow"><label>Due date</label><input class="dueDateEditInput" type="date" value="'+clean(currentDateFor(key))+'" min="2026-01-01" max="2026-12-31"></div><div class="amountEditActions"><button type="button" class="primary" data-action="save">Save</button><button type="button" data-action="cancel">Cancel</button>'+(hasAmountAdjustment(key)?'<button type="button" class="clear" data-action="clear">Reset amount</button>':'')+(isMoved(key)?'<button type="button" class="dueReset" data-action="reset-due-date">Reset due date</button>':'')+'</div><div class="amountEditMeta">Original estimate: '+clean(moneyCents(base))+'</div><div class="billsosEditError" aria-live="polite"></div>';
    document.body.appendChild(pop);
    var rect=anchor.getBoundingClientRect(),top=Math.min(window.innerHeight-pop.offsetHeight-12,Math.max(12,rect.bottom+8)),left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(12,rect.left));
    pop.style.top=top+'px';pop.style.left=left+'px';
    pop.addEventListener('click',function(event){var action=event.target&&event.target.getAttribute&&event.target.getAttribute('data-action');if(!action)return;event.preventDefault();event.stopPropagation();if(action==='save')saveAllFromPopover(pop,key);if(action==='cancel')closeRestoredPopover();if(action==='clear'){clearAmountAdjustment(key);closeRestoredPopover();syncRestoredEditors();recalcSoon()}if(action==='reset-due-date'){if(resetDueDate(key)){closeRestoredPopover();requestReload()}}});
    var input=pop.querySelector('.billsosAmountEditInput');
    input.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();saveAllFromPopover(pop,key)}if(event.key==='Escape'){event.preventDefault();closeRestoredPopover()}});
    setTimeout(function(){input.focus();input.select()},0);
  }
  function syncRestoredEditors(){
    ensureStyle();
    document.querySelectorAll('.day label.ev input[data-id],.day .ev input[data-id]').forEach(function(input){
      var key=input.getAttribute('data-id')||'',row=input.closest('.ev'),amount=amountFromKey(key);if(!row||amount>=0)return;
      var existing=row.querySelector('.amountEditBtn,.billsosEditRestoreBtn');
      if(!existing){existing=document.createElement('button');existing.type='button';existing.className='billsosEditRestoreBtn';var move=row.querySelector('.moveBtn');if(move&&move.parentNode===row)row.insertBefore(existing,move);else row.appendChild(existing)}
      existing.dataset.amountKey=key;existing.textContent=labelFor(key);existing.setAttribute('aria-label','Edit amount and due date for '+findRowName(row));row.classList.toggle('amount-edited',hasAmountAdjustment(key));
    });
    document.querySelectorAll('#detailContent .detailItem[data-detail-id],.mobile-sheet .detailItem[data-detail-id]').forEach(function(item){var key=item.getAttribute('data-detail-id')||'',amountNode=item.querySelector('.amt'),amount=amountFromKey(key);if(!amountNode||amount>=0)return;amountNode.textContent=moneyCents(adjustedAmountFor(key));amountNode.classList.add('amountEditable');amountNode.dataset.amountKey=key;amountNode.setAttribute('role','button');amountNode.setAttribute('tabindex','0');amountNode.setAttribute('aria-label','Edit amount and due date');item.classList.toggle('amount-edited',hasAmountAdjustment(key))});
  }
  function scheduleRestoredEditors(){clearTimeout(restoreTimer);restoreTimer=setTimeout(syncRestoredEditors,60)}
  function activePopover(){return document.querySelector('.amountEditPopover')}
  function syncPopover(){var pop=activePopover();if(pop&&lastKey)injectDueDate(pop,lastKey)}

  document.addEventListener('click',function(event){
    var target=event.target&&event.target.closest&&event.target.closest('.amountEditBtn,.amountEditable,.billsosEditRestoreBtn');
    if(target&&target.dataset&&target.dataset.amountKey){lastKey=target.dataset.amountKey;if(target.classList.contains('billsosEditRestoreBtn')){event.preventDefault();event.stopPropagation();openRestoredEditor(lastKey,target);return}setTimeout(syncPopover,0);setTimeout(syncPopover,80)}
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
  document.addEventListener('click',function(event){if(event.target&&event.target.closest&&event.target.closest('.amountEditable')){var key=event.target.closest('.amountEditable').dataset.amountKey;if(key){event.preventDefault();event.stopPropagation();openRestoredEditor(key,event.target.closest('.amountEditable'))}}else if(event.target&&event.target.closest&&!event.target.closest('.amountEditPopover')&&!event.target.closest('.billsosEditRestoreBtn')&&!event.target.closest('.amountEditBtn'))closeRestoredPopover()},true);
  document.addEventListener('keydown',function(event){var target=event.target&&event.target.closest&&event.target.closest('.amountEditable');if(target&&target.dataset.amountKey&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openRestoredEditor(target.dataset.amountKey,target)}},true);
  document.addEventListener('focusin',function(event){if(event.target&&event.target.classList&&event.target.classList.contains('dueDateEditInput'))event.target.select&&event.target.select()},true);

  try{new MutationObserver(function(){syncPopover();scheduleRestoredEditors()}).observe(document.documentElement,{subtree:true,childList:true})}catch(e){}
  watchLocal();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(pullCloud,500);setTimeout(pullCloud,1400);scheduleRestoredEditors()});else{setTimeout(pullCloud,500);setTimeout(pullCloud,1400);scheduleRestoredEditors()}
  window.addEventListener('load',scheduleRestoredEditors);
  window.addEventListener('hashchange',scheduleRestoredEditors);
  setTimeout(scheduleRestoredEditors,800);
  setTimeout(scheduleRestoredEditors,1800);
  setInterval(function(){pullCloud();scheduleRestoredEditors()},15000);
})();