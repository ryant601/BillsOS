(function(){
  'use strict';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function parseMoney(v){var n=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function money(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function originalDate(key){var d=String(key||'').split('|')[0]||'';return validDate(d)?d:''}
  function amountFromKey(key){var parts=String(key||'').split('|'),n=Number(parts[parts.length-1]);return isFinite(n)?n:0}
  function read(key){try{var parsed=JSON.parse(localStorage.getItem(key)||'{}');return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(e){return {}}}
  function write(key,map){try{localStorage.setItem(key,JSON.stringify(map||{}))}catch(e){}}
  function amountFor(key){var base=Math.abs(amountFromKey(key)),edit=read(AMOUNT_KEY)[key];return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function dateFor(key){var map=read(DATE_KEY),row=map[key]||{},orig=originalDate(key);return validDate(row.date)?row.date:orig}
  function isMoved(key){var d=dateFor(key),orig=originalDate(key);return validDate(d)&&validDate(orig)&&d!==orig}
  function dateLabel(v){if(!validDate(v))return '';var d=new Date(v+'T12:00:00');return d.toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}
  function saveAmount(key,value){var amount=Math.round(Math.abs(Number(value||0))*100)/100;if(!isFinite(amount)||amount<0)return false;var base=Math.abs(amountFromKey(key)),map=read(AMOUNT_KEY);if(Math.abs(amount-base)<0.005)delete map[key];else map[key]={amount:amount,updatedAt:new Date().toISOString()};write(AMOUNT_KEY,map);return true}
  function saveDate(key,date){if(!validDate(date)||!validDate(originalDate(key)))return false;var map=read(DATE_KEY),orig=originalDate(key);if(date===orig)delete map[key];else map[key]={date:date,originalDate:orig,status:'moved',updatedAt:new Date().toISOString()};write(DATE_KEY,map);return true}
  function resetDate(key){var map=read(DATE_KEY);if(map[key]){delete map[key];write(DATE_KEY,map);return true}return false}
  function closeEditor(){var existing=document.querySelector('.billsosCardEditPopover');if(existing)existing.remove()}
  function installStyle(){
    if(document.getElementById('billsosCardEditorStyle'))return;
    var s=document.createElement('style');
    s.id='billsosCardEditorStyle';
    s.textContent='.ev{position:relative}.billsosCardEditBtn{position:absolute;right:4px;bottom:4px;display:inline-grid;place-items:center;width:18px;height:18px;min-width:18px;border:1px solid rgba(20,35,55,.14);border-radius:999px;background:rgba(255,255,255,.74);color:inherit;padding:0;font:inherit;font-size:10px;font-weight:900;line-height:1;cursor:pointer;text-align:center;opacity:.72}.billsosCardEditBtn:hover,.billsosCardEditBtn:focus{background:#fff;border-color:rgba(31,58,61,.34);opacity:1;outline:none}.ev.amount-edited .billsosCardEditBtn,.ev.date-edited .billsosCardEditBtn{box-shadow:0 0 0 2px rgba(168,101,26,.13);border-color:rgba(168,101,26,.35)!important;opacity:1}.billsosCardEditPopover{position:fixed;z-index:100;width:min(285px,calc(100vw - 24px));display:grid;gap:9px;background:#fff;color:#14202c;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22)}.billsosCardEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}.billsosCardEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800;color:#14202c}.billsosCardEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.billsosCardEditActions button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px 10px;font-size:12px;font-weight:900;color:#14202c;cursor:pointer}.billsosCardEditActions .primary{background:#14202c;color:#fff;border-color:#14202c}.billsosCardEditActions .wide{grid-column:1 / -1;color:#7A4D16;background:#FBF4EA;border-color:rgba(168,101,26,.24)}.billsosCardEditMeta{font-size:11px;line-height:1.35;color:#5f6b7a}.billsosCardEditError{font-size:11px;color:#9f1239;font-weight:800}.day .ev:has(.billsosCardEditBtn){padding-right:24px!important;padding-bottom:22px!important}.day .ev:has(.billsosCardEditBtn)>.nm{min-width:0;overflow-wrap:anywhere}html[data-billsos-theme="dark"] .billsosCardEditBtn{background:rgba(15,23,42,.68);border-color:rgba(226,232,240,.18)}html[data-billsos-theme="dark"] .billsosCardEditPopover{background:#111827;color:#f8fafc;border-color:rgba(226,232,240,.16)}html[data-billsos-theme="dark"] .billsosCardEditPopover input{background:#020617;color:#f8fafc;border-color:rgba(226,232,240,.18)}html[data-billsos-theme="dark"] .billsosCardEditActions button{background:#1f2937;color:#f8fafc;border-color:rgba(226,232,240,.16)}html[data-billsos-theme="dark"] .billsosCardEditActions .primary{background:#f8fafc;color:#111827}';
    document.head.appendChild(s);
  }
  function rowKey(row){var input=row&&row.querySelector&&row.querySelector('input[data-id]');return (input&&input.getAttribute('data-id'))||row.getAttribute('data-id')||row.getAttribute('data-key')||''}
  function rowName(row){return text(row.querySelector('.nm'))||text(row.querySelector('span:not(.dot)'))||'Bill'}
  function openEditor(key,anchor){
    closeEditor();
    installStyle();
    var base=Math.abs(amountFromKey(key)),current=amountFor(key),currentDate=dateFor(key),orig=originalDate(key);
    var pop=document.createElement('div');
    pop.className='billsosCardEditPopover';
    pop.dataset.key=key;
    pop.innerHTML='<label>Amount</label><input class="billsosCardAmountInput" inputmode="decimal" autocomplete="off" value="'+clean(current.toFixed(2))+'"><label>Due date</label><input class="billsosCardDateInput" type="date" value="'+clean(currentDate)+'" min="2026-01-01" max="2026-12-31"><div class="billsosCardEditActions"><button type="button" class="primary" data-action="save">Save</button><button type="button" data-action="cancel">Cancel</button>'+(base!==current?'<button type="button" class="wide" data-action="reset-amount">Reset amount</button>':'')+(isMoved(key)?'<button type="button" class="wide" data-action="reset-date">Reset due date</button>':'')+'</div><div class="billsosCardEditMeta">Original estimate: '+clean(money(base))+(orig?' · Original due date: '+clean(dateLabel(orig)):'')+'</div><div class="billsosCardEditError" aria-live="polite"></div>';
    document.body.appendChild(pop);
    var rect=anchor.getBoundingClientRect(),top=Math.min(window.innerHeight-pop.offsetHeight-12,Math.max(12,rect.bottom+8)),left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(12,rect.left));
    pop.style.top=top+'px';pop.style.left=left+'px';
    function save(){var amountInput=pop.querySelector('.billsosCardAmountInput'),dateInput=pop.querySelector('.billsosCardDateInput'),error=pop.querySelector('.billsosCardEditError'),amount=parseMoney(amountInput.value);if(!isFinite(amount)||amount<0){error.textContent='Enter a valid amount.';return}if(!saveAmount(key,amount)){error.textContent='Amount could not be saved.';return}if(dateInput&&validDate(dateInput.value))saveDate(key,dateInput.value);closeEditor();sync();setTimeout(function(){location.reload()},180)}
    pop.addEventListener('click',function(ev){var action=ev.target&&ev.target.getAttribute&&ev.target.getAttribute('data-action');if(!action)return;ev.preventDefault();ev.stopPropagation();if(action==='save')save();if(action==='cancel')closeEditor();if(action==='reset-amount'){saveAmount(key,base);closeEditor();sync();setTimeout(function(){location.reload()},180)}if(action==='reset-date'){resetDate(key);closeEditor();setTimeout(function(){location.reload()},180)}});
    var input=pop.querySelector('.billsosCardAmountInput');
    input.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();save()}if(ev.key==='Escape'){ev.preventDefault();closeEditor()}});
    setTimeout(function(){input.focus();input.select()},0);
  }
  function sync(){
    installStyle();
    document.querySelectorAll('.ev').forEach(function(row){var key=rowKey(row),amount=amountFromKey(key);if(!key||amount>=0)return;var btn=row.querySelector('.billsosCardEditBtn,.amountEditBtn');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='billsosCardEditBtn';row.appendChild(btn)}btn.className='billsosCardEditBtn';btn.dataset.key=key;btn.textContent='✎';btn.title='Edit amount or due date';btn.setAttribute('aria-label','Edit amount and due date for '+rowName(row));row.classList.toggle('amount-edited',!!read(AMOUNT_KEY)[key]);row.classList.toggle('date-edited',isMoved(key));var amt=row.querySelector('.amt');if(amt)amt.textContent=(amount<0?'−':'')+money(amountFor(key))});
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,70)}
  document.addEventListener('click',function(ev){var btn=ev.target&&ev.target.closest&&ev.target.closest('.billsosCardEditBtn,.amountEditBtn');if(btn){var key=btn.dataset.key||btn.dataset.amountKey||rowKey(btn.closest('.ev'));if(key){ev.preventDefault();ev.stopPropagation();openEditor(key,btn);return}}if(ev.target&&ev.target.closest&&!ev.target.closest('.billsosCardEditPopover'))closeEditor()},true);
  try{new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true})}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  window.addEventListener('load',schedule);
  window.addEventListener('hashchange',schedule);
  setTimeout(schedule,300);setTimeout(schedule,1200);setInterval(schedule,2000);
})();