(function(){
  'use strict';

  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';
  var DONE_KEY='billsos-generated-done-v5';
  var timer=0,lastCheckmarkUpdatedAt=null,checkmarkSyncing=false;

  function esc(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function parseMoney(v){var n=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function money(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function read(k){try{var parsed=JSON.parse(localStorage.getItem(k)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(e){return {}}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v||{}))}catch(e){}}
  function cleanDone(done){var out={};Object.keys(done||{}).forEach(function(k){if(done[k])out[k]=1});return out}
  function readDone(){return cleanDone(read(DONE_KEY))}
  function writeDone(done){write(DONE_KEY,cleanDone(done))}
  function amountFromKey(key){var p=String(key||'').split('|'),n=Number(p[p.length-1]);return isFinite(n)?n:0}
  function originalDate(key){var d=String(key||'').split('|')[0]||'';return validDate(d)?d:''}
  function amountFor(key){var base=Math.abs(amountFromKey(key)),edit=read(AMOUNT_KEY)[key];return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function dateFor(key){var edit=read(DATE_KEY)[key],orig=originalDate(key);return edit&&validDate(edit.date)?edit.date:orig}
  function monthFromPanel(row){var panel=row&&row.closest&&row.closest('.month-panel'),id=(panel&&panel.id||'').replace(/^panel-/,'').toLowerCase();var m={june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12'};return m[id]||''}
  function renderedDate(row,key){var day=row&&row.closest&&row.closest('.day'),n=Number(day&&day.getAttribute('data-day')),mm=monthFromPanel(row);return mm&&n>=1&&n<=31?'2026-'+mm+'-'+String(n).padStart(2,'0'):dateFor(key)}
  function isMoved(key,row){var orig=originalDate(key),shown=row?renderedDate(row,key):dateFor(key);return validDate(orig)&&validDate(shown)&&orig!==shown}
  function dateLabel(v){if(!validDate(v))return '';var d=new Date(v+'T12:00:00');return d.toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}
  function saveAmount(key,value){var amount=Math.round(Math.abs(Number(value||0))*100)/100;if(!isFinite(amount)||amount<0)return false;var base=Math.abs(amountFromKey(key)),map=read(AMOUNT_KEY);if(Math.abs(amount-base)<0.005)delete map[key];else map[key]={amount:amount,updatedAt:new Date().toISOString()};write(AMOUNT_KEY,map);return true}
  function saveDate(key,date){if(!validDate(date)||!validDate(originalDate(key)))return false;var map=read(DATE_KEY),orig=originalDate(key);if(date===orig)delete map[key];else map[key]={date:date,originalDate:orig,status:'moved',updatedAt:new Date().toISOString()};write(DATE_KEY,map);return true}
  function resetDate(key){var map=read(DATE_KEY);delete map[key];write(DATE_KEY,map)}
  function rowKey(row){var cb=row&&row.querySelector&&row.querySelector('input[data-id]');return (cb&&cb.getAttribute('data-id'))||row.getAttribute('data-id')||row.getAttribute('data-key')||''}
  function rowName(row){return text(row.querySelector('.nm'))||text(row.querySelector('span:not(.dot)'))||'Bill'}

  function installStyle(){
    if(document.getElementById('billsosCardEditorStyle'))return;
    var s=document.createElement('style');
    s.id='billsosCardEditorStyle';
    s.textContent=''
      +'.day{overflow:hidden!important}'
      +'.day .events{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;overscroll-behavior:contain!important;scrollbar-width:thin!important;scrollbar-gutter:stable!important;padding-right:6px!important}'
      +'.day .events::-webkit-scrollbar{width:6px!important}.day .events::-webkit-scrollbar-track{background:rgba(20,35,55,.04)!important;border-radius:999px!important}.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.28)!important;border-radius:999px!important}.day .events:hover::-webkit-scrollbar-thumb{background:rgba(31,58,61,.42)!important}'
      +'.day .events .ev{flex:0 0 auto!important}.day:has(.events .ev:nth-child(3)) .events{box-shadow:inset 0 -14px 12px -16px rgba(20,35,55,.44)!important}'
      +'.ev{position:relative}.billsosDoneCheck{width:14px!important;height:14px!important;min-width:14px!important;margin:1px 0 0 0!important;accent-color:#1f3a3d;cursor:pointer;touch-action:manipulation}'
      +'.day .ev:has(.billsosDoneCheck){grid-template-columns:16px minmax(0,1fr) auto!important;align-items:start!important}.day .ev:has(.billsosDoneCheck)>.dot{display:none!important}.day .ev:has(.billsosDoneCheck)>.nm{grid-column:2!important;min-width:0!important;overflow-wrap:anywhere!important}.day .ev:has(.billsosDoneCheck)>.amt{grid-column:3!important}'
      +'.ev.done{opacity:.52!important}.ev.done .nm,.ev.done .amt{text-decoration:line-through;text-decoration-thickness:1.5px}'
      +'.amountEditBtn:not(.billsosCardEditBtn){position:absolute!important;right:4px!important;bottom:4px!important;display:inline-grid!important;place-items:center!important;width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;padding:0!important;overflow:hidden!important;text-indent:-999px!important;border-radius:999px!important}'
      +'.amountEditBtn:not(.billsosCardEditBtn)::after{content:"✎"!important;text-indent:0!important;position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;font-size:10px!important;font-weight:900!important}'
      +'.billsosCardEditBtn{position:absolute!important;right:4px!important;bottom:4px!important;display:inline-grid!important;place-items:center!important;width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;border:1px solid rgba(20,35,55,.14)!important;border-radius:999px!important;background:rgba(255,255,255,.74)!important;color:inherit!important;padding:0!important;font:inherit!important;font-size:10px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important;text-align:center!important;opacity:.72!important;touch-action:manipulation!important;text-indent:0!important;white-space:nowrap!important;overflow:hidden!important}'
      +'.billsosCardEditBtn:hover,.billsosCardEditBtn:focus{background:#fff!important;border-color:rgba(31,58,61,.34)!important;opacity:1!important;outline:none!important}.ev.amount-edited .billsosCardEditBtn,.ev.date-edited .billsosCardEditBtn{box-shadow:0 0 0 2px rgba(168,101,26,.13);border-color:rgba(168,101,26,.35)!important;opacity:1!important}'
      +'.day .ev:has(.billsosCardEditBtn){padding-right:24px!important;padding-bottom:22px!important}'
      +'.billsosCardEditPopover{position:fixed;z-index:100;width:min(285px,calc(100vw - 24px));display:grid;gap:9px;background:#fff;color:#14202c;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22)}'
      +'.billsosCardEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}.billsosCardEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800;color:#14202c}.billsosCardEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.billsosCardEditActions button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px 10px;font-size:12px;font-weight:900;color:#14202c;cursor:pointer}.billsosCardEditActions .primary{background:#14202c;color:#fff;border-color:#14202c}.billsosCardEditActions .wide{grid-column:1 / -1;color:#7A4D16;background:#FBF4EA;border-color:rgba(168,101,26,.24)}.billsosCardEditMeta{font-size:11px;line-height:1.35;color:#5f6b7a}.billsosCardEditError{font-size:11px;color:#9f1239;font-weight:800}';
    document.head.appendChild(s);
  }

  function closeEditor(){var existing=document.querySelector('.billsosCardEditPopover');if(existing)existing.remove()}
  function openEditor(key,anchor){
    closeEditor();installStyle();
    var row=anchor&&anchor.closest&&anchor.closest('.ev'),base=Math.abs(amountFromKey(key)),current=amountFor(key),currentDate=renderedDate(row,key),orig=originalDate(key);
    var pop=document.createElement('div');
    pop.className='billsosCardEditPopover';
    pop.innerHTML='<label>Amount</label><input class="billsosCardAmountInput" inputmode="decimal" autocomplete="off" value="'+esc(current.toFixed(2))+'"><label>Due date</label><input class="billsosCardDateInput" type="date" value="'+esc(currentDate)+'" min="2026-01-01" max="2026-12-31"><div class="billsosCardEditActions"><button type="button" class="primary" data-action="save">Save</button><button type="button" data-action="cancel">Cancel</button>'+(base!==current?'<button type="button" class="wide" data-action="reset-amount">Reset amount</button>':'')+(isMoved(key,row)?'<button type="button" class="wide" data-action="reset-date">Reset due date</button>':'')+'</div><div class="billsosCardEditMeta">Original estimate: '+esc(money(base))+(orig?' · Original due date: '+esc(dateLabel(orig)):'')+'</div><div class="billsosCardEditError" aria-live="polite"></div>';
    document.body.appendChild(pop);
    var rect=anchor.getBoundingClientRect(),top=Math.min(window.innerHeight-pop.offsetHeight-12,Math.max(12,rect.bottom+8)),left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(12,rect.left));
    pop.style.top=top+'px';pop.style.left=left+'px';
    function save(){var amountInput=pop.querySelector('.billsosCardAmountInput'),dateInput=pop.querySelector('.billsosCardDateInput'),error=pop.querySelector('.billsosCardEditError'),amount=parseMoney(amountInput.value);if(!isFinite(amount)||amount<0){error.textContent='Enter a valid amount.';return}saveAmount(key,amount);if(dateInput&&validDate(dateInput.value))saveDate(key,dateInput.value);closeEditor();sync();setTimeout(function(){location.reload()},180)}
    pop.addEventListener('click',function(ev){var action=ev.target&&ev.target.getAttribute&&ev.target.getAttribute('data-action');if(!action)return;ev.preventDefault();ev.stopPropagation();if(action==='save')save();if(action==='cancel')closeEditor();if(action==='reset-amount'){saveAmount(key,base);closeEditor();sync();setTimeout(function(){location.reload()},180)}if(action==='reset-date'){resetDate(key);closeEditor();setTimeout(function(){location.reload()},180)}});
    var input=pop.querySelector('.billsosCardAmountInput');
    input.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();save()}if(ev.key==='Escape'){ev.preventDefault();closeEditor()}});
    setTimeout(function(){input.focus();input.select()},0);
  }

  function normalizeLegacyEditButtons(row,key){
    row.querySelectorAll('.amountEditBtn').forEach(function(btn){
      btn.className='billsosCardEditBtn';
      btn.dataset.key=key;
      btn.dataset.amountKey=key;
      btn.textContent='✎';
      btn.title='Edit amount or due date';
      btn.setAttribute('aria-label','Edit amount and due date for '+rowName(row));
    });
  }
  function sync(){
    installStyle();
    var done=readDone();
    document.querySelectorAll('.ev').forEach(function(row){
      var key=rowKey(row),amount=amountFromKey(key);if(!key||amount>=0)return;
      normalizeLegacyEditButtons(row,key);
      var cb=row.querySelector('.billsosDoneCheck');
      if(!cb){cb=document.createElement('input');cb.type='checkbox';cb.className='billsosDoneCheck';row.insertBefore(cb,row.firstChild)}
      cb.dataset.id=key;cb.checked=!!done[key];row.classList.toggle('done',!!done[key]);
      var btn=row.querySelector('.billsosCardEditBtn');
      if(!btn){btn=document.createElement('button');btn.type='button';btn.className='billsosCardEditBtn';row.appendChild(btn)}
      btn.dataset.key=key;btn.dataset.amountKey=key;btn.textContent='✎';btn.title='Edit amount or due date';btn.setAttribute('aria-label','Edit amount and due date for '+rowName(row));
      row.classList.toggle('amount-edited',!!read(AMOUNT_KEY)[key]);row.classList.toggle('date-edited',isMoved(key,row));
      var amt=row.querySelector('.amt');if(amt)amt.textContent=(amount<0?'−':'')+money(amountFor(key));
    });
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,60)}
  function doneFromDom(){var done=readDone();document.querySelectorAll('.billsosDoneCheck[data-id]').forEach(function(cb){if(cb.checked)done[cb.dataset.id]=1;else delete done[cb.dataset.id]});return cleanDone(done)}
  function applyDone(done){done=cleanDone(done);writeDone(done);document.querySelectorAll('.billsosDoneCheck[data-id]').forEach(function(cb){var checked=!!done[cb.dataset.id];cb.checked=checked;var row=cb.closest('.ev');if(row)row.classList.toggle('done',checked)})}
  async function pullCheckmarks(){try{var r=await fetch('/api/checkmarks?pull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();if(!data||!data.completed)return;if(data.updatedAt&&data.updatedAt===lastCheckmarkUpdatedAt)return;lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt;applyDone(data.completed)}catch(e){}}
  async function pushCheckmarks(done){if(checkmarkSyncing)return;checkmarkSyncing=true;done=cleanDone(done||doneFromDom());writeDone(done);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:done})});if(r.ok){var data=await r.json();lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt}}catch(e){}finally{checkmarkSyncing=false}}

  document.addEventListener('click',function(ev){var btn=ev.target&&ev.target.closest&&ev.target.closest('.billsosCardEditBtn,.amountEditBtn');if(btn){var key=btn.dataset.key||btn.dataset.amountKey||rowKey(btn.closest('.ev'));if(key){ev.preventDefault();ev.stopPropagation();openEditor(key,btn);return}}if(ev.target&&ev.target.closest&&!ev.target.closest('.billsosCardEditPopover'))closeEditor()},true);
  document.addEventListener('change',function(ev){var cb=ev.target;if(!cb||!cb.classList||!cb.classList.contains('billsosDoneCheck'))return;var done=doneFromDom();writeDone(done);var row=cb.closest('.ev');if(row)row.classList.toggle('done',!!cb.checked);pushCheckmarks(done)},true);
  try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true})}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule();pullCheckmarks()});else{schedule();pullCheckmarks()}
  window.addEventListener('load',function(){schedule();pullCheckmarks()});
  window.addEventListener('hashchange',schedule);
  setTimeout(schedule,200);setTimeout(schedule,700);setTimeout(schedule,1500);setInterval(schedule,1800);setInterval(pullCheckmarks,15000);
})();