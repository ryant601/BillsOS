(function(){
  'use strict';

  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';
  var DONE_KEY='billsos-generated-done-v5';
  var syncTimer=0,lastRemoteUpdate=null,pushing=false,deleting=false;

  function read(key){try{var v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(e){return {}}}
  function write(key,value){
    try{
      var payload=JSON.stringify(value||{});
      localStorage.setItem(key,payload);
      return localStorage.getItem(key)===payload;
    }catch(e){return false}
  }
  function cloneMap(value){try{return JSON.parse(JSON.stringify(value||{}))}catch(e){return {}}}
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function confirmCloudSave(){
    if(typeof window.BillsOSForceThisDeviceSync!=='function')return {ok:true,confirmed:false};
    for(var attempt=0;attempt<3;attempt++){
      try{if(await window.BillsOSForceThisDeviceSync())return {ok:true,confirmed:true}}catch(e){}
      if(attempt<2)await wait(300*(attempt+1));
    }
    return {ok:false,confirmed:false};
  }
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function money(v){var n=Math.abs(Number(v||0)),whole=Math.abs(n-Math.round(n))<.005;return n.toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:whole?0:2,maximumFractionDigits:2})}
  function keyParts(key){var p=String(key||'').split('|');return{date:p[0]||'',name:p.slice(1,-1).join('|')||'Item',amount:Number(p[p.length-1]||0)}}
  function amountFromKey(key){var n=keyParts(key).amount;return isFinite(n)?n:0}
  function originalDate(key){var d=keyParts(key).date;return validDate(d)?d:''}
  function nameFromKey(key){return String(keyParts(key).name||'Item').replace(/\s+/g,' ').trim()}
  function rowKey(row){return row.dataset.billsosKey||row.dataset.id||row.dataset.key||((row.querySelector('input[data-id]')||{}).dataset||{}).id||''}
  function amountFor(key){var edit=read(AMOUNT_KEY)[key],base=Math.abs(amountFromKey(key));return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function signedAmountFor(key){return amountFromKey(key)<0?-amountFor(key):amountFor(key)}
  function renderedDate(row,key){var day=row.closest('.day'),panel=row.closest('.month-panel'),n=Number(day&&day.dataset.day),id=String(panel&&panel.id||'').replace(/^panel-/,'').toLowerCase(),months={june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12','jan-2027':'01','feb-2027':'02','mar-2027':'03','apr-2027':'04','may-2027':'05','jun-2027':'06','jul-2027':'07','aug-2027':'08','sep-2027':'09','oct-2027':'10','nov-2027':'11','dec-2027':'12'},mm=months[id],year=Number(panel&&panel.dataset.year)||Number(String(originalDate(key)).slice(0,4))||2026;return mm&&n?year+'-'+mm+'-'+String(n).padStart(2,'0'):originalDate(key)}
  function dateFor(key,row){var edit=read(DATE_KEY)[key];return edit&&validDate(edit.date)?edit.date:renderedDate(row,key)}
  function formatDate(v){return validDate(v)?new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''}
  function saveAmount(key,value){var n=Math.round(Math.abs(Number(value||0))*100)/100,map=read(AMOUNT_KEY),base=Math.abs(amountFromKey(key));if(!isFinite(n))return false;if(Math.abs(n-base)<.005)delete map[key];else map[key]={amount:n,updatedAt:new Date().toISOString()};return write(AMOUNT_KEY,map)}
  function saveDate(key,date){var orig=originalDate(key),map=read(DATE_KEY);if(!validDate(date)||!validDate(orig))return false;if(date===orig)delete map[key];else map[key]={date:date,originalDate:orig,status:'moved',updatedAt:new Date().toISOString()};return write(DATE_KEY,map)}
  function saveEditAtomically(key,amountValue,dateValue){
    var n=Math.round(Math.abs(Number(amountValue||0))*100)/100,orig=originalDate(key),base=Math.abs(amountFromKey(key));
    if(!isFinite(n))return {ok:false,message:'Enter a valid amount.'};
    if(!validDate(dateValue)||!validDate(orig))return {ok:false,message:'Choose a valid date.'};
    var beforeAmount=read(AMOUNT_KEY),beforeDate=read(DATE_KEY),nextAmount=cloneMap(beforeAmount),nextDate=cloneMap(beforeDate),stamp=new Date().toISOString();
    if(Math.abs(n-base)<.005)delete nextAmount[key];else nextAmount[key]={amount:n,updatedAt:stamp};
    if(dateValue===orig)delete nextDate[key];else nextDate[key]={date:dateValue,originalDate:orig,status:'moved',updatedAt:stamp};
    if(!write(AMOUNT_KEY,nextAmount))return {ok:false,message:'This browser could not save the amount locally.'};
    if(!write(DATE_KEY,nextDate)){
      write(AMOUNT_KEY,beforeAmount);
      return {ok:false,message:'This browser could not save the date. No changes were applied.'};
    }
    return {ok:true};
  }
  function cleanDone(map){var out={};Object.keys(map||{}).forEach(function(k){if(map[k])out[k]=1});return out}
  function currentDone(){return cleanDone(read(DONE_KEY))}
  function applyDone(map){map=cleanDone(map);write(DONE_KEY,map);document.querySelectorAll('.billsosDoneCheck').forEach(function(cb){var checked=!!map[cb.dataset.id];if(cb.checked!==checked)cb.checked=checked;var row=cb.closest('.ev');if(row)row.classList.toggle('done',checked)})}

  function installCss(){
    if(document.getElementById('billsosCardEditorStyle'))return;
    var style=document.createElement('style');
    style.id='billsosCardEditorStyle';
    style.textContent='body{padding:10px!important}.wrap{max-width:1420px!important}.hero{padding:12px 18px!important;margin-bottom:8px!important}.hero h1{font-size:clamp(36px,4vw,54px)!important;margin:2px 0 4px!important}.hero .sub{font-size:15px!important}.tabs{margin:8px 0 10px!important}.month-panel{padding:12px 16px!important}.month-panel header{margin-bottom:8px!important}.month-panel h1{font-size:36px!important}.dow-row,.grid{gap:7px!important}.grid{margin-top:6px!important}.day{height:216px!important;min-height:216px!important;padding:8px!important;overflow:hidden!important}.dtop,.bod,.eod{font-size:12px!important}.dnum{font-size:24px!important}.day .events{display:flex!important;flex-direction:column!important;gap:6px!important;flex:1 1 auto!important;min-height:0!important;margin:6px 0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;scrollbar-width:thin!important;padding-right:5px!important}.day .events::-webkit-scrollbar{width:6px!important}.day .events::-webkit-scrollbar-thumb{background:rgba(31,58,61,.28)!important;border-radius:999px!important}.day .events .ev{flex:0 0 auto!important}.ev.billsosCard{position:relative!important;display:grid!important;grid-template-columns:20px minmax(0,1fr) 26px!important;grid-template-rows:auto auto!important;align-items:center!important;column-gap:8px!important;row-gap:5px!important;min-width:0!important;min-height:68px!important;border-radius:11px!important;padding:8px!important;font-size:12.5px!important;line-height:1.15!important;overflow:hidden!important}.ev.billsosCard>*{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;float:none!important;margin:0!important}.billsosDoneCheck{grid-column:1!important;grid-row:1 / span 2!important;width:18px!important;height:18px!important;min-width:18px!important;align-self:center!important;accent-color:#1f3a3d}.billsosCardBody{grid-column:2!important;grid-row:1 / span 2!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:4px!important;overflow:hidden!important}.billsosCardName{display:block!important;width:100%!important;font-size:12.5px!important;font-weight:750!important;line-height:1.16!important;white-space:normal!important;overflow:hidden!important;overflow-wrap:anywhere!important;word-break:break-word!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}.billsosCardAmount{display:block!important;width:100%!important;font-size:13.5px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.billsosCardEditBtn,.billsosCardDeleteBtn{grid-column:3!important;justify-self:end!important;display:grid!important;place-items:center!important;width:24px!important;height:24px!important;min-width:24px!important;border:1px solid rgba(20,35,55,.15)!important;border-radius:999px!important;background:rgba(255,255,255,.86)!important;color:inherit!important;padding:0!important;font-size:12px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important}.billsosCardEditBtn{grid-row:1!important;align-self:start!important}.billsosCardDeleteBtn{grid-row:2!important;align-self:end!important;color:#a33!important}.ev.done{opacity:.52!important}.ev.done .billsosCardName,.ev.done .billsosCardAmount{text-decoration:line-through}.billsosCardEditPopover{position:fixed;z-index:1000;width:min(310px,calc(100vw - 24px));display:grid;gap:9px;background:#fff;color:#14202c;border:1px solid rgba(20,35,55,.18);border-radius:16px;padding:12px;box-shadow:0 18px 48px rgba(20,35,55,.22)}.billsosCardEditPopover label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5f6b7a}.billsosCardEditPopover input{width:100%;border:1px solid rgba(20,35,55,.18);border-radius:12px;padding:10px 11px;font:inherit;font-weight:800}.billsosCardDateMeta{font-size:11px;line-height:1.4;color:#5f6b7a;background:#f8fafc;border-radius:10px;padding:8px 9px}.billsosCardEditActions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.billsosCardEditActions button{border:1px solid rgba(20,35,55,.14);border-radius:999px;background:#fff;padding:8px;font-size:12px;font-weight:900}.billsosCardEditActions .primary{background:#14202c;color:#fff}.billsosCardEditActions .wide{grid-column:1/-1}@media(max-width:900px){body{padding:8px!important}.day{height:218px!important;min-height:218px!important}.month-panel{padding:11px!important}.ev.billsosCard{grid-template-columns:21px minmax(0,1fr) 28px!important;min-height:70px!important}.billsosCardName{font-size:13px!important}.billsosCardAmount{font-size:14px!important}.billsosDoneCheck{width:19px!important;height:19px!important;min-width:19px!important}}';
    style.textContent+='.day{height:172px!important;min-height:172px!important;max-height:172px!important}.dnum{font-size:18px!important}.day .events{flex:0 0 76px!important;height:76px!important;min-height:44px!important;max-height:76px!important;gap:3px!important;scrollbar-width:none!important;padding-right:10px!important}.day .events::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}.ev.billsosCard{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:0!important;row-gap:0!important;min-height:35px!important;height:35px!important;max-height:35px!important;padding:3px 4px 3px 7px!important}.billsosDoneCheck{position:absolute!important;left:7px!important;top:7px!important;grid-column:auto!important;grid-row:auto!important;width:12px!important;height:12px!important;min-width:12px!important}.billsosCardBody{grid-column:1/-1!important;grid-row:1/span 2!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:0!important;min-width:0!important;overflow:hidden!important}.billsosCardName{font-size:11.5px!important;line-height:1.2!important;white-space:nowrap!important;text-overflow:ellipsis!important;display:block!important;padding-left:17px!important}.billsosCardAmount{font-size:10.5px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;display:block!important}.billsosCardEditBtn,.billsosCardDeleteBtn{position:absolute!important;top:50%!important;grid-column:auto!important;grid-row:auto!important;width:19px!important;height:19px!important;min-width:19px!important;transform:translateY(-50%)!important;opacity:0!important;pointer-events:none!important;border-radius:6px!important}.billsosCardEditBtn{right:25px!important}.billsosCardDeleteBtn{right:4px!important}.ev.billsosCard:hover .billsosCardEditBtn,.ev.billsosCard:hover .billsosCardDeleteBtn,.ev.billsosCard:focus-within .billsosCardEditBtn,.ev.billsosCard:focus-within .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important}@media(max-width:900px){.day{height:190px!important;min-height:190px!important;max-height:190px!important}.day .events{flex-basis:94px!important;height:94px!important;max-height:94px!important;gap:4px!important}.ev.billsosCard{min-height:42px!important;height:42px!important;max-height:42px!important;padding:4px 52px 4px 9px!important}.billsosCardName{font-size:13px!important}.billsosCardAmount{font-size:12px!important}.billsosDoneCheck{width:15px!important;height:15px!important;min-width:15px!important}.billsosCardEditBtn,.billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important;width:21px!important;height:21px!important;min-width:21px!important}}';
    document.head.appendChild(style);
  }

  function closeEditor(force){
    var p=document.querySelector('.billsosCardEditPopover');
    if(!p)return true;
    if(!force&&p.dataset.dirty==='1'&&!confirm('Discard unsaved transaction changes?'))return false;
    p.remove();
    return true;
  }
  function setEditorStatus(pop,text,state){
    var el=pop&&pop.querySelector('.billsosCardEditError');if(!el)return;
    el.textContent=text||'';
    el.style.color=state==='error'?'#9a3b2d':(state==='success'?'#2c6446':'#5f6b7a');
  }
  function openEditor(row,key,anchor){
    closeEditor(true);
    var base=Math.abs(amountFromKey(key)),amount=amountFor(key),date=dateFor(key,row),orig=originalDate(key),isIncome=amountFromKey(key)>0,pop=document.createElement('div'),dateMeta='';
    if(validDate(orig)&&validDate(date))dateMeta='<div class="billsosCardDateMeta">Original date: <b>'+formatDate(orig)+'</b><br>Currently scheduled: <b>'+formatDate(date)+'</b></div>';
    pop.className='billsosCardEditPopover';
    pop.dataset.dirty='0';
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label','Edit transaction');
    pop.innerHTML='<div style="font-size:12px;font-weight:900;color:#14202c">Editing transaction</div><div style="font-size:11px;color:#5f6b7a">Changes are not saved until you press Save.</div><label>Amount</label><input class="amountInput" inputmode="decimal" value="'+amount.toFixed(2)+'"><label>Date</label><input class="dateInput" type="date" value="'+date+'">'+dateMeta+'<div class="billsosCardEditActions"><button class="primary" data-action="save">Save</button><button data-action="cancel">Cancel</button>'+(amount!==base?'<button class="wide" data-action="reset-amount">Reset amount</button>':'')+(date!==orig?'<button class="wide" data-action="reset-date">Reset date</button>':'')+'</div><div class="billsosCardEditError" role="status" aria-live="polite" style="min-height:14px;font-size:11px;color:#5f6b7a">Editing '+(isIncome?'income':'payment')+' occurrence.</div>';
    document.body.appendChild(pop);
    var amountInput=pop.querySelector('.amountInput'),dateInput=pop.querySelector('.dateInput'),saveBtn=pop.querySelector('[data-action="save"]');
    function markDirty(){pop.dataset.dirty='1';setEditorStatus(pop,'Unsaved changes','info')}
    amountInput.addEventListener('input',markDirty);dateInput.addEventListener('change',markDirty);
    var r=anchor.getBoundingClientRect();pop.style.left=Math.max(12,Math.min(r.left,innerWidth-pop.offsetWidth-12))+'px';pop.style.top=Math.max(12,Math.min(r.bottom+8,innerHeight-pop.offsetHeight-12))+'px';
    pop.onclick=async function(e){
      var action=e.target.dataset.action;if(!action)return;e.preventDefault();
      if(action==='cancel'){closeEditor(true);return}
      if(action==='save'){
        if(saveBtn.disabled)return;
        saveBtn.disabled=true;saveBtn.textContent='Saving…';setEditorStatus(pop,'Saving locally…','info');
        var saved=saveEditAtomically(key,amountInput.value,dateInput.value);
        if(!saved.ok){setEditorStatus(pop,saved.message,'error');saveBtn.disabled=false;saveBtn.textContent='Save';return}
        pop.dataset.dirty='0';
        setEditorStatus(pop,'Saved locally. Confirming sync…','info');
        var sync=await confirmCloudSave();
        if(!sync.ok){
          pop.dataset.dirty='0';
          setEditorStatus(pop,'Saved on this device, but cloud sync was not confirmed. Press Save to retry sync.','error');
          saveBtn.disabled=false;saveBtn.textContent='Retry sync';
          return;
        }
        setEditorStatus(pop,sync.confirmed?'Saved and synced ✓':'Saved ✓','success');
        saveBtn.textContent='Saved ✓';
        await wait(450);
        location.reload();
        return;
      }
      if(action==='reset-amount'){
        if(!saveAmount(key,base)){setEditorStatus(pop,'Could not reset the amount.','error');return}
        pop.dataset.dirty='0';setEditorStatus(pop,'Amount reset. Confirming sync…','info');
        var amountSync=await confirmCloudSave();
        if(!amountSync.ok){setEditorStatus(pop,'Amount reset locally, but cloud sync was not confirmed.','error');return}
        setEditorStatus(pop,'Amount reset and saved ✓','success');await wait(350);location.reload();return;
      }
      if(action==='reset-date'){
        var map=read(DATE_KEY);delete map[key];
        if(!write(DATE_KEY,map)){setEditorStatus(pop,'Could not reset the date.','error');return}
        pop.dataset.dirty='0';setEditorStatus(pop,'Date reset. Confirming sync…','info');
        var dateSync=await confirmCloudSave();
        if(!dateSync.ok){setEditorStatus(pop,'Date reset locally, but cloud sync was not confirmed.','error');return}
        setEditorStatus(pop,'Date reset and saved ✓','success');await wait(350);location.reload();
      }
    };
    amountInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveBtn.click()}});
    dateInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveBtn.click()}});
    setTimeout(function(){amountInput.focus();amountInput.select()},0);
  }

  function eventDates(item){return [item&&item.date,item&&item.iso,item&&item.startDate,item&&item.effectiveDate].filter(validDate)}
  function normalizedOneAmount(item){var raw=Number(item&&((item.amount!=null)?item.amount:item.value)||0),type=String(item&&item.type||'').toLowerCase(),name=String(item&&item.name||''),correction=/correction|adjustment/.test(type)||/correction|adjustment/i.test(name);return correction?raw:(type==='income'?Math.abs(raw):-Math.abs(raw))}
  function noteSkip(row,date){var marker='Skipped '+date,notes=String(row.notes||'').trim();if(notes.indexOf(marker)<0)row.notes=notes?(notes+' · '+marker):marker}
  function incomeOccurs(row,date){var schedule=row.schedule||'manual',start=row.startDate||row.start||row.anchorDate||'',d=new Date(date+'T12:00:00'),day=d.getDate(),dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();if(schedule==='semi-monthly-15-30')return day===15||day===Math.min(30,dim);if(schedule==='monthly')return day===(validDate(start)?Math.min(Number(start.slice(8,10)),dim):1);if(schedule==='biweekly'&&validDate(start)){var gap=Math.round((d-new Date(start+'T12:00:00'))/86400000);return gap>=0&&gap%14===0}return validDate(start)&&start===date}
  async function deleteOccurrence(row,key){
    if(deleting)return;
    var name=nameFromKey(key),orig=originalDate(key),shown=dateFor(key,row),base=amountFromKey(key);
    if(!confirm('Remove '+name+' from '+formatDate(shown)+'?\n\nOne-time items will be deleted. Recurring bills or income will skip only this occurrence.'))return;
    deleting=true;
    try{
      var response=await fetch('/api/bills?delete='+Date.now(),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('Could not load Control Center data');
      var data=await response.json(),one=Array.isArray(data.oneTimeEvents)?data.oneTimeEvents:[],bills=Array.isArray(data.bills)?data.bills:[],income=Array.isArray(data.income)?data.income:[],kind='',source=null,index=-1;
      index=one.findIndex(function(item){return String(item.name||item.label||item.title||'One-time item')===name&&eventDates(item).indexOf(orig)>=0&&Math.abs(normalizedOneAmount(item)-base)<.005});
      if(index>=0){source=one[index];one.splice(index,1);kind='one-time item'}
      if(!source){index=bills.findIndex(function(item){var month=orig.slice(0,7),day=Number(orig.slice(8,10)),dim=new Date(Number(orig.slice(0,4)),Number(orig.slice(5,7)),0).getDate();return item&&item.active!==false&&String(item.name||'Bill')===name&&Math.abs(-Math.abs(Number(item.amount||0))-base)<.005&&Math.min(Number(item.dueDay||1),dim)===day&&(!item.startMonth||item.startMonth<=month)&&(!item.endMonth||item.endMonth>=month)});if(index>=0){source=bills[index];source.excludedDates=Array.from(new Set((Array.isArray(source.excludedDates)?source.excludedDates:[]).concat(orig))).sort();noteSkip(source,orig);kind='recurring bill'}}
      if(!source){index=income.findIndex(function(item){return item&&item.active!==false&&String(item.name||'Income')===name&&Math.abs(Math.abs(Number(item.amount||0))-base)<.005&&incomeOccurs(item,orig)});if(index>=0){source=income[index];source.excludedDates=Array.from(new Set((Array.isArray(source.excludedDates)?source.excludedDates:[]).concat(orig))).sort();noteSkip(source,orig);kind='recurring income'}}
      if(!source)throw new Error('Could not identify the matching Control Center source');
      data.oneTimeEvents=one;data.bills=bills;data.income=income;
      var saved=await fetch('/api/bills',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(data)});if(!saved.ok)throw new Error('Could not save the deletion');
      var amountMap=read(AMOUNT_KEY),dateMap=read(DATE_KEY),done=currentDone();delete amountMap[key];delete dateMap[key];delete done[key];write(AMOUNT_KEY,amountMap);write(DATE_KEY,dateMap);write(DONE_KEY,done);
      location.reload();
    }catch(err){alert((err&&err.message)||'Could not remove this item.')}finally{deleting=false}
  }

  function normalizeCard(row,done){
    var key=rowKey(row);if(!key)return;
    var name=nameFromKey(key),signed=signedAmountFor(key),checked=!!done[key];
    row.dataset.billsosKey=key;row.dataset.billsosName=name;row.classList.add('billsosCard');row.classList.toggle('done',checked);row.replaceChildren();
    var cb=document.createElement('input');cb.type='checkbox';cb.className='billsosDoneCheck';cb.dataset.id=key;cb.checked=checked;cb.setAttribute('aria-label','Mark '+name+' complete');
    var body=document.createElement('div');body.className='billsosCardBody';
    var nameEl=document.createElement('span');nameEl.className='billsosCardName';nameEl.textContent=name;
    var amountEl=document.createElement('span');amountEl.className='billsosCardAmount';amountEl.textContent=(signed<0?'−':'+')+money(Math.abs(signed));body.appendChild(nameEl);body.appendChild(amountEl);
    var edit=document.createElement('button');edit.type='button';edit.className='billsosCardEditBtn';edit.dataset.key=key;edit.textContent='✎';edit.title='Edit amount or date';edit.setAttribute('aria-label','Edit amount and date for '+name);
    var del=document.createElement('button');del.type='button';del.className='billsosCardDeleteBtn';del.dataset.key=key;del.textContent='×';del.title='Remove this occurrence';del.setAttribute('aria-label','Remove '+name+' from this date');
    row.appendChild(cb);row.appendChild(body);row.appendChild(edit);row.appendChild(del);
  }

  function sync(){installCss();var done=currentDone();document.querySelectorAll('.events .ev').forEach(function(row){normalizeCard(row,done)})}
  function schedule(){clearTimeout(syncTimer);syncTimer=setTimeout(sync,80)}
  async function pullDone(){try{var r=await fetch('/api/checkmarks?x='+Date.now(),{cache:'no-store'}),data=await r.json();if(data&&data.completed&&data.updatedAt!==lastRemoteUpdate){lastRemoteUpdate=data.updatedAt;applyDone(data.completed)}}catch(e){}}
  async function pushDone(map){if(pushing)return;pushing=true;write(DONE_KEY,map);try{var r=await fetch('/api/checkmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:map})}),data=await r.json();lastRemoteUpdate=data.updatedAt||lastRemoteUpdate}catch(e){}finally{pushing=false}}

  document.addEventListener('click',function(e){var edit=e.target.closest&&e.target.closest('.billsosCardEditBtn');if(edit){e.preventDefault();e.stopPropagation();var row=edit.closest('.ev');openEditor(row,edit.dataset.key,edit);return}var del=e.target.closest&&e.target.closest('.billsosCardDeleteBtn');if(del){e.preventDefault();e.stopPropagation();deleteOccurrence(del.closest('.ev'),del.dataset.key);return}if(!e.target.closest('.billsosCardEditPopover'))closeEditor(false)},true);
  document.addEventListener('change',function(e){if(!e.target.classList.contains('billsosDoneCheck'))return;var map=currentDone();if(e.target.checked)map[e.target.dataset.id]=1;else delete map[e.target.dataset.id];applyDone(map);pushDone(map)},true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){schedule();pullDone()});else{schedule();pullDone()}
  window.addEventListener('load',schedule);window.addEventListener('hashchange',schedule);setTimeout(schedule,400);setTimeout(schedule,1200);setInterval(pullDone,30000);
})();