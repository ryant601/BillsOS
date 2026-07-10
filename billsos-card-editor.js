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
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
  function setAttr(el,name,value){if(el&&el.getAttribute(name)!==String(value))el.setAttribute(name,String(value))}
  function setClass(el,name,on){if(el&&el.classList.contains(name)!==!!on)el.classList.toggle(name,!!on)}

  function installStyle(){
    if(document.getElementById('billsosCardEditorStyle'))return;
    var s=document.createElement('style');
    s.id='billsosCardEditorStyle';
    s.textContent=''
      +'body{padding:10px!important}'
      +'.wrap{max-width:1420px!important}'
      +'.pill{margin-bottom:8px!important;padding:5px 10px!important;font-size:11px!important}'
      +'.hero{padding:12px 18px!important;margin-bottom:8px!important;min-height:0!important}'
      +'.hero h1{font-size:clamp(36px,4vw,54px)!important;margin:2px 0 4px!important;line-height:.92!important}'
      +'.hero .sub{font-size:15px!important;line-height:1.2!important}'
      +'.nav a{padding:13px 17px!important;border-radius:15px!important;font-size:15px!important}'
      +'.tabs{margin:8px 0 10px!important;gap:7px!important}.tabs button{padding:8px 15px!important;font-size:13px!important}'
      +'.month-panel{padding:12px 16px!important}.month-panel header{margin-bottom:8px!important}.month-panel h1{font-size:36px!important;line-height:1!important}.eyebrow{font-size:10px!important}.chips{gap:7px!important}.chip{padding:8px 10px!important;min-width:112px!important}.chip .k{font-size:10px!important}.chip .v{font-size:18px!important}'
      +'.dow-row,.grid{gap:7px!important}.dow-row span{font-size:11px!important}.grid{margin-top:6px!important}'
      +'.day{height:216px!important;min-height:216px!important;border-radius:14px!important;padding:8px!important;overflow:hidden!important}'
      +'.dtop,.bod,.eod{font-size:12px!important;line-height:1.15!important}.dnum{font-size:24px!important;line-height:.95!important}.badge{font-size:9px!important;padding:3px 6px!important}'
      +'.day .events{display:flex!important;flex-direction:column!important;gap:6px!important;flex:1 1 auto!important;min-height:0!important;margin:6px 0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;overscroll-behavior:contain!important;scrollbar-width:thin!important;scrollbar-gutter:stable!important;padding-right:5px!important}'
      +'.day .events::-webkit-scrollbar{width:6px!important}.day .events::-webkit-scrollbar-track{background:rgba(20,35,55,.04)!important;border-radius:999px!important}.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.28)!important;border-radius:999px!important}.day .events:hover::-webkit-scrollbar-thumb{background:rgba(31,58,61,.42)!important}'
      +'.day .events .ev{flex:0 0 auto!important}.day:has(.events .ev:nth-child(3)) .events{box-shadow:inset 0 -14px 12px -16px rgba(20,35,55,.44)!important}'
      +'.ev{position:relative!important;min-height:54px!important;border-radius:11px!important;padding:8px 28px 18px 8px!important;font-size:12.5px!important;line-height:1.12!important;gap:5px!important}'
      +'.ev .nm{font-size:12.5px!important;font-weight:750!important;line-height:1.08!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;word-break:normal!important;overflow-wrap:anywhere!important}'
      +'.ev .amt{font-size:12.5px!important;font-weight:950!important;line-height:1.1!important;white-space:nowrap!important}'
      +'.billsosDoneCheck{width:17px!important;height:17px!important;min-width:17px!important;margin:0!important;accent-color:#1f3a3d;cursor:pointer;touch-action:manipulation}'
      +'.day .ev:has(.billsosDoneCheck){grid-template-columns:18px minmax(0,1fr) auto!important;align-items:start!important}.day .ev:has(.billsosDoneCheck)>.dot{display:none!important}.day .ev:has(.billsosDoneCheck)>.nm{grid-column:2!important;min-width:0!important}.day .ev:has(.billsosDoneCheck)>.amt{grid-column:3!important}'
      +'.ev.done{opacity:.52!important}.ev.done .nm,.ev.done .amt{text-decoration:line-through;text-decoration-thickness:1.5px}'
      +'.amountEditBtn:not(.billsosCardEditBtn){position:absolute!important;right:5px!important;bottom:5px!important;display:inline-grid!important;place-items:center!important;width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;padding:0!important;overflow:hidden!important;text-indent:-999px!important;border-radius:999px!important}'
      +'.amountEditBtn:not(.billsosCardEditBtn)::after{content:"✎"!important;text-indent:0!important;position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;font-size:11px!important;font-weight:900!important}'
      +'.billsosCardEditBtn{position:absolute!important;right:5px!important;bottom:5px!important;display:inline-grid!important;place-items:center!important;width:20px!important;height:20px!important;min-width:20px!important;max-width:20px!important;border:1px solid rgba(20,35,55,.14)!important;border-radius:999px!important;background:rgba(255,255,255,.76)!important;color:inherit!important;padding:0!important;font:inherit!important;font-size:11px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important;text-align:center!important;opacity:.76!important;touch-action:manipulation!important;text-indent:0!important;white-space:nowrap!important;overflow:hidden!important}'
      +'.billsosCardEditBtn:hover,.billsosCardEditBtn:focus{background:#fff!important;border-color:rgba(31,58,61,.34)!important;opacity:1!important;outline:none!important}.ev.amount-edited .billsosCardEditBtn,.ev.date-edited .billsosCardEditBtn{box-shadow:0 0 0 2px rgba(168,101,26,.13);border-color:rgba(168,101,26,.35)!important;opacity:1!important}'
      +'.billsosCardEditPopover{position:fixed;z-index:100;width:min(285px,calc(100vw - 24px));display:grid;gap:9px;background:#fff;color:#14202c;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22)}'
      +'.billsosCardEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}.billsosCardEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800;color:#14202c}.billsosCardEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.billsosCardEditActions button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px 10px;font-size:12px;font-weight:900;color:#14202c;cursor:pointer}.billsosCardEditActions .primary{background:#14202c;color:#fff;border-color:#14202c}.billsosCardEditActions .wide{grid-column:1 / -1;color:#7A4D16;background:#FBF4EA;border-color:rgba(168,101,26,.24)}.billsosCardEditMeta{font-size:11px;line-height:1.35;color:#5f6b7a}.billsosCardEditError{font-size:11px;color:#9f1239;font-weight:800}'
      +'@media(max-width:900px){body{padding:8px!important}.day{height:218px!important;min-height:218px!important}.hero{padding:12px!important}.month-panel{padding:11px!important}.ev{font-size:13px!important}.ev .nm,.ev .amt{font-size:13px!important}}';
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
      if(!btn.classList.contains('billsosCardEditBtn'))btn.className='billsosCardEditBtn';
      if(btn.dataset.key!==key)btn.dataset.key=key;
      if(btn.dataset.amountKey!==key)btn.dataset.amountKey=key;
      setText(btn,'✎');
      if(btn.title!=='Edit amount or due date')btn.title='Edit amount or due date';
      setAttr(btn,'aria-label','Edit amount and due date for '+rowName(row));
    });
  }
  function sync(){
    installStyle();
    var done=readDone(),amountMap=read(AMOUNT_KEY);
    document.querySelectorAll('.ev').forEach(function(row){
      var key=rowKey(row),amount=amountFromKey(key);if(!key)return;
      var cb=row.querySelector('.billsosDoneCheck');
      if(!cb){cb=document.createElement('input');cb.type='checkbox';cb.className='billsosDoneCheck';row.insertBefore(cb,row.firstChild)}
      if(cb.dataset.id!==key)cb.dataset.id=key;
      var checked=!!done[key];if(cb.checked!==checked)cb.checked=checked;setClass(row,'done',checked);
      if(amount<0){
        normalizeLegacyEditButtons(row,key);
        var btn=row.querySelector('.billsosCardEditBtn');
        if(!btn){btn=document.createElement('button');btn.type='button';btn.className='billsosCardEditBtn';row.appendChild(btn)}
        if(btn.dataset.key!==key)btn.dataset.key=key;if(btn.dataset.amountKey!==key)btn.dataset.amountKey=key;setText(btn,'✎');if(btn.title!=='Edit amount or due date')btn.title='Edit amount or due date';setAttr(btn,'aria-label','Edit amount and due date for '+rowName(row));
        setClass(row,'amount-edited',!!amountMap[key]);setClass(row,'date-edited',isMoved(key,row));
        var amt=row.querySelector('.amt'),newAmount='−'+money(amountFor(key));if(amt&&amt.textContent!==newAmount)amt.textContent=newAmount;
      }
    });
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,80)}
  function doneFromDom(){var done=readDone();document.querySelectorAll('.billsosDoneCheck[data-id]').forEach(function(cb){if(cb.checked)done[cb.dataset.id]=1;else delete done[cb.dataset.id]});return cleanDone(done)}
  function applyDone(done){done=cleanDone(done);writeDone(done);document.querySelectorAll('.billsosDoneCheck[data-id]').forEach(function(cb){var checked=!!done[cb.dataset.id];if(cb.checked!==checked)cb.checked=checked;var row=cb.closest('.ev');setClass(row,'done',checked)})}
  async function pullCheckmarks(){try{var r=await fetch('/api/checkmarks?pull='+Date.now(),{cache:'no-store'});if(!r.ok)return;var data=await r.json();if(!data||!data.completed)return;if(data.updatedAt&&data.updatedAt===lastCheckmarkUpdatedAt)return;lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt;applyDone(data.completed)}catch(e){}}
  async function pushCheckmarks(done){if(checkmarkSyncing)return;checkmarkSyncing=true;done=cleanDone(done||doneFromDom());writeDone(done);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:done})});if(r.ok){var data=await r.json();lastCheckmarkUpdatedAt=data.updatedAt||lastCheckmarkUpdatedAt}}catch(e){}finally{checkmarkSyncing=false}}

  document.addEventListener('click',function(ev){var btn=ev.target&&ev.target.closest&&ev.target.closest('.billsosCardEditBtn,.amountEditBtn');if(btn){var key=btn.dataset.key||btn.dataset.amountKey||rowKey(btn.closest('.ev'));if(key){ev.preventDefault();ev.stopPropagation();openEditor(key,btn);return}}if(ev.target&&ev.target.closest&&!ev.target.closest('.billsosCardEditPopover'))closeEditor()},true);
  document.addEventListener('change',function(ev){var cb=ev.target;if(!cb||!cb.classList||!cb.classList.contains('billsosDoneCheck'))return;var done=doneFromDom();writeDone(done);var row=cb.closest('.ev');setClass(row,'done',!!cb.checked);pushCheckmarks(done)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule();pullCheckmarks()});else{schedule();pullCheckmarks()}
  window.addEventListener('load',function(){schedule();pullCheckmarks()});
  window.addEventListener('hashchange',schedule);
  setTimeout(schedule,250);setTimeout(schedule,900);setTimeout(schedule,1800);setInterval(pullCheckmarks,30000);
})();