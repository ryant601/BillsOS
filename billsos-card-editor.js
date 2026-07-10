(function(){
  'use strict';

  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';
  var DONE_KEY='billsos-generated-done-v5';
  var syncTimer=0,lastRemoteUpdate=null,pushing=false;

  function read(key){try{var v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(e){return {}}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value||{}))}catch(e){}}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function money(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function amountFromKey(key){var p=String(key||'').split('|'),n=Number(p[p.length-1]);return isFinite(n)?n:0}
  function originalDate(key){var d=String(key||'').split('|')[0]||'';return validDate(d)?d:''}
  function rowKey(row){var input=row.querySelector('input[data-id]');return input&&input.dataset.id||row.dataset.id||row.dataset.key||''}
  function rowName(row){var el=row.querySelector('.nm');return String(el&&el.textContent||'Bill').replace(/\s+/g,' ').trim()}
  function amountFor(key){var edit=read(AMOUNT_KEY)[key],base=Math.abs(amountFromKey(key));return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function renderedDate(row,key){var day=row.closest('.day'),panel=row.closest('.month-panel'),n=Number(day&&day.dataset.day),id=String(panel&&panel.id||'').replace(/^panel-/,'').toLowerCase(),months={june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12'},mm=months[id];return mm&&n?'2026-'+mm+'-'+String(n).padStart(2,'0'):originalDate(key)}
  function dateFor(key,row){var edit=read(DATE_KEY)[key];return edit&&validDate(edit.date)?edit.date:renderedDate(row,key)}
  function saveAmount(key,value){var n=Math.round(Math.abs(Number(value||0))*100)/100,map=read(AMOUNT_KEY),base=Math.abs(amountFromKey(key));if(!isFinite(n))return false;if(Math.abs(n-base)<.005)delete map[key];else map[key]={amount:n,updatedAt:new Date().toISOString()};write(AMOUNT_KEY,map);return true}
  function saveDate(key,date){var orig=originalDate(key),map=read(DATE_KEY);if(!validDate(date)||!validDate(orig))return false;if(date===orig)delete map[key];else map[key]={date:date,originalDate:orig,status:'moved',updatedAt:new Date().toISOString()};write(DATE_KEY,map);return true}
  function cleanDone(map){var out={};Object.keys(map||{}).forEach(function(k){if(map[k])out[k]=1});return out}
  function currentDone(){return cleanDone(read(DONE_KEY))}
  function applyDone(map){map=cleanDone(map);write(DONE_KEY,map);document.querySelectorAll('.billsosDoneCheck').forEach(function(cb){var checked=!!map[cb.dataset.id];if(cb.checked!==checked)cb.checked=checked;var row=cb.closest('.ev');if(row)row.classList.toggle('done',checked)})}
  function installCss(){
    if(document.getElementById('billsosCardEditorStyle'))return;
    var style=document.createElement('style');
    style.id='billsosCardEditorStyle';
    style.textContent='body{padding:10px!important}.wrap{max-width:1420px!important}.hero{padding:12px 18px!important;margin-bottom:8px!important}.hero h1{font-size:clamp(36px,4vw,54px)!important;margin:2px 0 4px!important}.hero .sub{font-size:15px!important}.tabs{margin:8px 0 10px!important}.month-panel{padding:12px 16px!important}.month-panel header{margin-bottom:8px!important}.month-panel h1{font-size:36px!important}.dow-row,.grid{gap:7px!important}.grid{margin-top:6px!important}.day{height:216px!important;min-height:216px!important;padding:8px!important;overflow:hidden!important}.dtop,.bod,.eod{font-size:12px!important}.dnum{font-size:24px!important}.day .events{display:flex!important;flex-direction:column!important;gap:6px!important;flex:1 1 auto!important;min-height:0!important;margin:6px 0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;scrollbar-width:thin!important;padding-right:5px!important}.day .events::-webkit-scrollbar{width:6px!important}.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.28)!important;border-radius:999px!important}.ev{position:relative!important;min-height:54px!important;border-radius:11px!important;padding:8px 30px 8px 8px!important;font-size:12.5px!important;line-height:1.12!important;gap:5px!important}.ev .nm{font-size:12.5px!important;font-weight:750!important;line-height:1.08!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}.ev .amt{font-size:12.5px!important;font-weight:950!important;white-space:nowrap!important}.billsosDoneCheck{width:17px!important;height:17px!important;min-width:17px!important;margin:0!important;accent-color:#1f3a3d}.day .ev:has(.billsosDoneCheck){grid-template-columns:18px minmax(0,1fr) auto!important;align-items:start!important}.day .ev:has(.billsosDoneCheck)>.dot{display:none!important}.ev.done{opacity:.52!important}.ev.done .nm,.ev.done .amt{text-decoration:line-through}.moveBtn,.amountEditBtn{display:none!important}.billsosCardEditBtn{position:absolute!important;right:5px!important;bottom:5px!important;display:grid!important;place-items:center!important;width:22px!important;height:22px!important;min-width:22px!important;border:1px solid rgba(20,35,55,.15)!important;border-radius:999px!important;background:rgba(255,255,255,.82)!important;color:inherit!important;padding:0!important;font-size:12px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important}.billsosCardEditPopover{position:fixed;z-index:1000;width:min(290px,calc(100vw - 24px));display:grid;gap:9px;background:#fff;color:#14202c;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22)}.billsosCardEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}.billsosCardEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800}.billsosCardEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.billsosCardEditActions button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px;font-size:12px;font-weight:900}.billsosCardEditActions .primary{background:#14202c;color:#fff}.billsosCardEditActions .wide{grid-column:1/-1}@media(max-width:900px){body{padding:8px!important}.day{height:218px!important;min-height:218px!important}.month-panel{padding:11px!important}.ev,.ev .nm,.ev .amt{font-size:13px!important}}';
    document.head.appendChild(style);
  }
  function closeEditor(){var p=document.querySelector('.billsosCardEditPopover');if(p)p.remove()}
  function openEditor(row,key,anchor){
    closeEditor();
    var base=Math.abs(amountFromKey(key)),amount=amountFor(key),date=dateFor(key,row),orig=originalDate(key),pop=document.createElement('div');
    pop.className='billsosCardEditPopover';
    pop.innerHTML='<label>Amount</label><input class="amountInput" inputmode="decimal" value="'+amount.toFixed(2)+'"><label>Due date</label><input class="dateInput" type="date" value="'+date+'"><div class="billsosCardEditActions"><button class="primary" data-action="save">Save</button><button data-action="cancel">Cancel</button>'+(amount!==base?'<button class="wide" data-action="reset-amount">Reset amount</button>':'')+(date!==orig?'<button class="wide" data-action="reset-date">Reset due date</button>':'')+'</div>';
    document.body.appendChild(pop);
    var r=anchor.getBoundingClientRect();pop.style.left=Math.max(12,Math.min(r.left,innerWidth-pop.offsetWidth-12))+'px';pop.style.top=Math.max(12,Math.min(r.bottom+8,innerHeight-pop.offsetHeight-12))+'px';
    pop.onclick=function(e){var action=e.target.dataset.action;if(!action)return;e.preventDefault();if(action==='cancel')closeEditor();if(action==='save'){saveAmount(key,pop.querySelector('.amountInput').value);saveDate(key,pop.querySelector('.dateInput').value);location.reload()}if(action==='reset-amount'){saveAmount(key,base);location.reload()}if(action==='reset-date'){var map=read(DATE_KEY);delete map[key];write(DATE_KEY,map);location.reload()}};
  }
  function sync(){
    installCss();
    var done=currentDone();
    document.querySelectorAll('.ev').forEach(function(row){
      var key=rowKey(row);if(!key)return;
      var cb=row.querySelector('.billsosDoneCheck');
      if(!cb){cb=document.createElement('input');cb.type='checkbox';cb.className='billsosDoneCheck';row.insertBefore(cb,row.firstChild)}
      cb.dataset.id=key;cb.checked=!!done[key];row.classList.toggle('done',!!done[key]);
      row.querySelectorAll('.moveBtn,.amountEditBtn,.billsosCardEditBtn').forEach(function(button){button.remove()});
      if(amountFromKey(key)<0){var btn=document.createElement('button');btn.type='button';btn.className='billsosCardEditBtn';btn.dataset.key=key;btn.textContent='✎';btn.title='Edit amount or due date';btn.setAttribute('aria-label','Edit amount and due date for '+rowName(row));row.appendChild(btn);var amt=row.querySelector('.amt');if(amt)amt.textContent='−'+money(amountFor(key))}
    });
  }
  function schedule(){clearTimeout(syncTimer);syncTimer=setTimeout(sync,80)}
  async function pullDone(){try{var r=await fetch('/api/checkmarks?x='+Date.now(),{cache:'no-store'}),data=await r.json();if(data&&data.completed&&data.updatedAt!==lastRemoteUpdate){lastRemoteUpdate=data.updatedAt;applyDone(data.completed)}}catch(e){}}
  async function pushDone(map){if(pushing)return;pushing=true;write(DONE_KEY,map);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:map})}),data=await r.json();lastRemoteUpdate=data.updatedAt||lastRemoteUpdate}catch(e){}finally{pushing=false}}

  document.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('.billsosCardEditBtn');if(btn){e.preventDefault();e.stopPropagation();var row=btn.closest('.ev');openEditor(row,btn.dataset.key,btn);return}if(!e.target.closest('.billsosCardEditPopover'))closeEditor()},true);
  document.addEventListener('change',function(e){if(!e.target.classList.contains('billsosDoneCheck'))return;var map=currentDone();if(e.target.checked)map[e.target.dataset.id]=1;else delete map[e.target.dataset.id];applyDone(map);pushDone(map)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule();pullDone()});else{schedule();pullDone()}
  window.addEventListener('load',schedule);window.addEventListener('hashchange',schedule);setTimeout(schedule,400);setTimeout(schedule,1200);setInterval(pullDone,30000);
})();