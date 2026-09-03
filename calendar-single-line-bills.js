(function(){
  'use strict';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var DATE_KEY='billsos-pay-adjust-v1';

  function read(key){try{var v=JSON.parse(localStorage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch(_e){return {}}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value||{}));return true}catch(_e){return false}}
  function validDate(v){return /^20\d{2}-\d{2}-\d{2}$/.test(String(v||''))}
  function parts(key){var p=String(key||'').split('|');return{date:p[0]||'',amount:Number(p[p.length-1]||0)}}
  function amountFor(key){var base=Math.abs(parts(key).amount),edit=read(AMOUNT_KEY)[key];return edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):base}
  function dateFor(key){var base=parts(key).date,edit=read(DATE_KEY)[key];return edit&&validDate(edit.date)?edit.date:base}
  function money(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}

  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      '.day .events{gap:4px!important}',
      /* Two stacked lines: the name owns a full-width line, the amount sits under it.
         A day cell is ~90px of usable width, which cannot fit a name and a currency
         amount side by side, so sharing one line silently collapsed the name to 0px. */
      '.day .events .ev{display:grid!important;grid-template-columns:13px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:5px!important;row-gap:0!important;align-items:center!important;justify-content:start!important;box-sizing:border-box!important;position:relative!important;min-width:0!important;min-height:35px!important;height:35px!important;max-height:35px!important;padding:3px 4px 3px 7px!important;overflow:hidden!important;contain:layout paint!important;font-size:11.5px!important;line-height:1.15!important}',
      '.day .events .ev>*{min-width:0!important;margin:0!important}',
      /* The check/dot is taken out of the grid flow so the amount line can use the
         pill's full inner width. Only the name is indented past it. */
      '.day .events .ev>.dot{position:absolute!important;left:8px!important;top:12px!important;grid-column:auto!important;grid-row:auto!important;width:5px!important;height:5px!important;margin:0!important;z-index:2!important}',
      '.day .events .ev>.nm{grid-column:1 / -1!important;grid-row:1!important;align-self:end!important;display:block!important;width:100%!important;min-width:0!important;padding-left:11px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:11.5px!important;font-weight:600!important;letter-spacing:-.005em!important;line-height:1.2!important}',
      '.day .events .ev>.amt{grid-column:1 / -1!important;grid-row:2!important;align-self:start!important;display:block!important;width:100%!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;font-size:10.5px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      '.day .events .ev>.flag,.day .events .ev>.note,.day .events .ev>.meta,.day .events .ev>small{display:none!important}',
      '.day .events .ev.billsosCard{grid-template-columns:minmax(0,1fr)!important;column-gap:0!important;min-height:35px!important;height:35px!important;max-height:35px!important;padding:3px 4px 3px 7px!important}',
      '.day .events .ev.billsosCard>.amountEditBtn,.day .events .ev.billsosCard>.billsosEditRestoreBtn,.day .events .ev.billsosCard>.moveBtn{display:none!important;pointer-events:none!important}',
      '.day .events .ev.billsosCard .billsosDoneCheck{position:absolute!important;left:7px!important;top:7px!important;grid-column:auto!important;grid-row:auto!important;width:12px!important;height:12px!important;min-width:12px!important;margin:0!important;padding:0!important;transform:none!important;box-shadow:none!important;accent-color:#c15f3c!important;z-index:2!important}',
      '.day .events .ev.billsosCard .billsosCardBody{grid-column:1 / -1!important;grid-row:1 / span 2!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;gap:0!important;width:100%!important;height:100%!important;min-width:0!important;overflow:hidden!important}',
      '.day .events .ev.billsosCard .billsosCardName{display:block!important;width:100%!important;height:auto!important;min-width:0!important;padding-left:17px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;-webkit-line-clamp:unset!important;font-size:11.5px!important;font-weight:600!important;letter-spacing:-.005em!important;line-height:1.2!important}',
      '.day .events .ev.billsosCard .billsosCardAmount{display:block!important;width:100%!important;height:auto!important;padding-left:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;font-size:10.5px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      /* Edit and delete float over the right edge so they never steal name width. */
      '.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{position:absolute!important;top:50%!important;grid-column:auto!important;grid-row:auto!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;padding:0!important;border:1px solid rgba(31,30,29,.16)!important;border-radius:6px!important;background:#fff!important;font-size:10px!important;line-height:1!important;transform:translateY(-50%)!important;opacity:0!important;pointer-events:none!important;transition:opacity .12s ease!important;z-index:2!important}',
      '.day .events .ev.billsosCard .billsosCardEditBtn{right:25px!important}',
      '.day .events .ev.billsosCard .billsosCardDeleteBtn{right:4px!important}',
      '.day .events .ev.billsosCard:hover .billsosCardEditBtn,.day .events .ev.billsosCard:hover .billsosCardDeleteBtn,.day .events .ev.billsosCard:focus-within .billsosCardEditBtn,.day .events .ev.billsosCard:focus-within .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important}',
      '.day .events .ev.billsosCard:hover .billsosCardBody,.day .events .ev.billsosCard:focus-within .billsosCardBody{padding-right:48px!important}',
      '.billsosStableEdit{position:fixed!important;z-index:1200!important;width:min(310px,calc(100vw - 24px))!important;display:grid!important;gap:9px!important;background:#fff!important;color:#1f1e1d!important;border:1px solid rgba(31,30,29,.14)!important;border-radius:14px!important;padding:12px!important;box-shadow:0 8px 28px rgba(31,30,29,.16)!important}',
      '.billsosStableEdit label{font-size:11px!important;font-weight:600!important;text-transform:uppercase!important;letter-spacing:.08em!important;color:#6b6a63!important}.billsosStableEdit input{width:100%!important;border:1px solid rgba(31,30,29,.16)!important;border-radius:10px!important;padding:10px 11px!important;font:inherit!important;font-weight:600!important}.billsosStableEditActions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}.billsosStableEditActions button{border:1px solid rgba(31,30,29,.12)!important;border-radius:10px!important;background:#fff!important;padding:9px!important;font-size:12px!important;font-weight:650!important}.billsosStableEditActions .primary{background:#c15f3c!important;border-color:transparent!important;color:#fff!important}.billsosStableEditStatus{min-height:16px!important;font-size:11px!important;color:#6b6a63!important}',
      /* Narrow desktop still packs 7 columns, so ease the type down a step to keep
         the full currency amount from ellipsising. */
      '@media(min-width:901px) and (max-width:1240px){.day .events .ev>.nm,.day .events .ev.billsosCard .billsosCardName{font-size:11px!important}.day .events .ev>.amt,.day .events .ev.billsosCard .billsosCardAmount{font-size:10px!important;letter-spacing:-.01em!important}}',
      /* One-column mobile calendar: cards are full width, so the controls stay visible. */
      '@media(max-width:900px){.day .events{gap:5px!important}.day .events .ev,.day .events .ev.billsosCard{min-height:42px!important;height:42px!important;max-height:42px!important;padding:4px 52px 4px 9px!important}.day .events .ev>.nm,.day .events .ev.billsosCard .billsosCardName{font-size:13px!important;padding-left:21px!important}.day .events .ev>.amt,.day .events .ev.billsosCard .billsosCardAmount{font-size:12px!important}.day .events .ev>.dot{left:10px!important;top:15px!important}.day .events .ev.billsosCard .billsosDoneCheck{left:9px!important;top:10px!important;width:15px!important;height:15px!important;min-width:15px!important}.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important;width:21px!important;height:21px!important;min-width:21px!important}.day .events .ev.billsosCard .billsosCardEditBtn{right:27px!important}.day .events .ev.billsosCard:hover .billsosCardBody,.day .events .ev.billsosCard:focus-within .billsosCardBody{padding-right:0!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function closeStableEditor(){var p=document.querySelector('.billsosStableEdit');if(p)p.remove()}
  function stableKey(row,button){return String((button&&button.dataset&&button.dataset.key)||(row&&row.dataset&&row.dataset.billsosKey)||'')}
  function openStableEditor(row,button){
    var key=stableKey(row,button);if(!key)return;
    closeStableEditor();
    var p=parts(key),amount=amountFor(key),date=dateFor(key),name=((row.querySelector('.billsosCardName')||{}).textContent||'Item').trim(),pop=document.createElement('div');
    pop.className='billsosStableEdit billsosCardEditPopover';
    pop.innerHTML='<label>Amount</label><input class="stableAmount" inputmode="decimal" value="'+amount.toFixed(2)+'"><label>Date</label><input class="stableDate" type="date" value="'+(validDate(date)?date:p.date)+'"><div class="billsosStableEditActions"><button type="button" class="primary" data-stable-action="save">Save</button><button type="button" data-stable-action="cancel">Cancel</button></div><div class="billsosStableEditStatus" aria-live="polite">Editing '+name+'.</div>';
    document.body.appendChild(pop);
    var r=button.getBoundingClientRect();pop.style.left=Math.max(12,Math.min(r.left,innerWidth-pop.offsetWidth-12))+'px';pop.style.top=Math.max(12,Math.min(r.bottom+8,innerHeight-pop.offsetHeight-12))+'px';
    pop.addEventListener('click',function(e){
      var action=e.target&&e.target.dataset&&e.target.dataset.stableAction;if(!action)return;e.preventDefault();e.stopPropagation();
      if(action==='cancel'){closeStableEditor();return}
      var amountInput=pop.querySelector('.stableAmount'),dateInput=pop.querySelector('.stableDate'),status=pop.querySelector('.billsosStableEditStatus'),nextAmount=Math.round(Math.abs(Number(amountInput.value||0))*100)/100,nextDate=dateInput.value,base=Math.abs(p.amount);
      if(!isFinite(nextAmount)){status.textContent='Enter a valid amount.';return}
      if(!validDate(nextDate)||!validDate(p.date)){status.textContent='Choose a valid date.';return}
      var amountMap=read(AMOUNT_KEY),dateMap=read(DATE_KEY),now=new Date().toISOString();
      if(Math.abs(nextAmount-base)<.005)delete amountMap[key];else amountMap[key]={amount:nextAmount,updatedAt:now};
      if(nextDate===p.date)delete dateMap[key];else dateMap[key]={date:nextDate,originalDate:p.date,status:'moved',updatedAt:now};
      if(!write(AMOUNT_KEY,amountMap)||!write(DATE_KEY,dateMap)){status.textContent='Could not save this edit.';return}
      var savedDate=read(DATE_KEY)[key];
      if(nextDate!==p.date&&(!savedDate||savedDate.date!==nextDate)){status.textContent='Date did not save. Nothing was reloaded.';return}
      status.textContent='Saved. Refreshing calendar…';
      setTimeout(function(){location.reload()},120);
    });
  }

  function bindStableEditing(){
    if(window.__billsosStableCalendarEditing)return;window.__billsosStableCalendarEditing=true;
    document.addEventListener('click',function(e){
      var button=e.target&&e.target.closest&&e.target.closest('.billsosCardEditBtn');
      if(button){var row=button.closest('.ev.billsosCard');if(!row)return;e.preventDefault();e.stopPropagation();openStableEditor(row,button);return}
      if(!e.target.closest('.billsosStableEdit'))closeStableEditor();
    },false);
  }

  function boot(){install();bindStableEditing()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',install,{once:true});
})();
