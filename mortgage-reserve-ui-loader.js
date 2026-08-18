'use strict';

const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;

const reserveUiScript = String.raw`<script id="billsosMortgageReserveUi">
(function(){
  'use strict';
  if(window.__billsosMortgageReserveUi)return;
  window.__billsosMortgageReserveUi=true;

  var SHORT={june:'june',july:'july',august:'aug',september:'sep',october:'oct',november:'nov',december:'dec'};

  function money(v){return '$'+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}

  function addStyles(){
    if(document.getElementById('billsosMortgageReserveStyles'))return;
    var s=document.createElement('style');
    s.id='billsosMortgageReserveStyles';
    s.textContent='.bo-reserve-event{background:#edf0f7!important;color:#44516a!important;border:1px dashed rgba(68,81,106,.22)}.bo-reserve-event .amt{color:#44516a}.bo-reserve-note{display:flex;justify-content:space-between;gap:8px;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(68,81,106,.18);font-size:9px;font-weight:800;color:#667085}.bo-available-chip .v{color:#44516a!important}.bo-reserve-summary{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(68,81,106,.16);border-radius:13px;background:#f7f8fb;color:#44516a;font-size:12px;font-weight:700}.bo-reserve-summary b{color:#263445}';
    document.head.appendChild(s);
  }

  function balanceFor(model,iso){
    return (model.balances||[]).find(function(row){return row.iso===iso})||null;
  }

  function addReserveSummary(panel,month){
    if(!panel||panel.querySelector('.bo-reserve-summary'))return;
    var rows=(month.rows||[]).filter(function(row){return row.type==='reserve'&&row.reserveAmount>0});
    if(!rows.length)return;
    var total=rows.reduce(function(sum,row){return sum+Number(row.reserveAmount||0)},0);
    var summary=document.createElement('div');
    summary.className='bo-reserve-summary';
    summary.innerHTML='<b>Mortgage funding plan:</b> '+rows.map(function(row){return 'day '+row.day+' '+money(row.reserveAmount)}).join(' · ')+' · '+money(total)+' earmarked before payment.';
    var header=panel.querySelector('header');
    if(header)header.insertAdjacentElement('afterend',summary);
  }

  function addAvailableChip(panel,month){
    if(!panel||panel.querySelector('.bo-available-chip'))return;
    var chips=panel.querySelector('.chips');
    if(!chips)return;
    var chip=document.createElement('div');
    chip.className='chip bo-available-chip';
    chip.innerHTML='<span class="k">Available</span><span class="v">'+money(month.availableEnd==null?month.end:month.availableEnd)+'</span>';
    chips.appendChild(chip);
  }

  function decorateDay(panel,row,model){
    var day=panel&&panel.querySelector('.day[data-day="'+row.day+'"]');
    if(!day)return;
    var events=day.querySelector('.events');
    if(events&&!events.querySelector('[data-reserve-id="'+esc(row.sourceId)+'"]')){
      var item=document.createElement('div');
      item.className='ev xfer bo-reserve-event';
      item.setAttribute('data-reserve-id',row.sourceId||row.name);
      item.innerHTML='<span class="dot"></span><span class="nm">'+esc(row.name)+'</span><span class="amt">−'+money(row.reserveAmount)+'</span>';
      events.appendChild(item);
    }
    if(!day.querySelector('.bo-reserve-note')){
      var balance=balanceFor(model,row.iso),end=day.querySelector('.eod');
      if(balance&&end){
        var note=document.createElement('div');
        note.className='bo-reserve-note';
        note.innerHTML='<span>available after reserve</span><b>'+money(balance.availableBalance==null?balance.balance:balance.availableBalance)+'</b>';
        end.insertAdjacentElement('afterend',note);
      }
    }
  }

  async function apply(){
    if(!window.BillsOSCashflow)return false;
    var response=await fetch('/api/bills?reserveUi='+Date.now(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)return false;
    var data=await response.json();
    var model=window.BillsOSCashflow.build(data,{floorNegative:false});
    Object.keys(SHORT).forEach(function(key){
      var month=model.months&&model.months[key],panel=document.getElementById('panel-'+SHORT[key]);
      if(!month||!panel)return;
      addAvailableChip(panel,month);
      addReserveSummary(panel,month);
      (month.rows||[]).filter(function(row){return row.type==='reserve'&&row.reserveAmount>0}).forEach(function(row){decorateDay(panel,row,model)});
    });
    window.BillsOSMortgageReserves={loaded:true,reserves:model.reserves||[],engine:model};
    return true;
  }

  function start(){
    addStyles();
    var tries=0;
    (function tick(){
      apply().then(function(ok){if(!ok&&++tries<120)setTimeout(tick,100)}).catch(function(){if(++tries<120)setTimeout(tick,100)});
    })();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;

fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
  const output = originalReadFileSync.call(fs, filePath, ...args);
  if (typeof output !== 'string') return output;
  if (path.basename(String(filePath)) !== 'generated-v5.html') return output;
  if (output.includes('id="billsosMortgageReserveUi"')) return output;
  return output.replace('</body>', reserveUiScript + '\n</body>');
};
