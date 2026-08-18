'use strict';

const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;

const splitUiScript = String.raw`<script id="billsosMortgageSplitUi">
(function(){
  'use strict';
  if(window.__billsosMortgageSplitUi)return;
  window.__billsosMortgageSplitUi=true;

  var SHORT={june:'june',july:'july',august:'aug',september:'sep',october:'oct',november:'nov',december:'dec'};
  function money(v){return '$'+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}

  function addStyles(){
    if(document.getElementById('billsosMortgageSplitStyles'))return;
    var s=document.createElement('style');
    s.id='billsosMortgageSplitStyles';
    s.textContent='.bo-split-payment{background:#f7e7e0!important;color:#9a4635!important;border:1px solid rgba(154,70,53,.16)}.bo-split-summary{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(154,70,53,.13);border-radius:13px;background:#fff8f5;color:#7d493e;font-size:12px;font-weight:700}.bo-split-summary b{color:#5e332a}';
    document.head.appendChild(s);
  }

  function setChip(panel,label,value){
    var chips=panel&&panel.querySelectorAll('.chip');
    if(!chips)return;
    Array.prototype.forEach.call(chips,function(chip){var k=chip.querySelector('.k'),v=chip.querySelector('.v');if(k&&v&&String(k.textContent||'').trim().toLowerCase()===label.toLowerCase())v.textContent=money(value)});
  }

  function removeOldMortgageRows(panel){
    if(!panel)return;
    panel.querySelectorAll('.ev').forEach(function(row){var text=String(row.textContent||'');if(/Mortgage \(Rocket\)/i.test(text)&&!/\b[12]\/2\b/.test(text))row.remove()});
    panel.querySelectorAll('.bo-reserve-event,.bo-reserve-summary,.bo-available-chip,.bo-reserve-note').forEach(function(node){node.remove()});
  }

  function decorateDay(panel,row){
    var day=panel&&panel.querySelector('.day[data-day="'+row.day+'"]');
    if(!day)return;
    var events=day.querySelector('.events');
    if(!events||events.querySelector('[data-split-id="'+esc(row.sourceId)+'"]'))return;
    var item=document.createElement('div');
    item.className='ev out bo-split-payment';
    item.setAttribute('data-split-id',row.sourceId||row.name);
    item.innerHTML='<span class="dot"></span><span class="nm">'+esc(row.name)+'</span><span class="amt">−'+money(Math.abs(row.amount))+'</span>';
    events.appendChild(item);
  }

  function updateDayBalances(panel,month,model){
    if(!panel||!month)return;
    var previous=Number(month.begin||0);
    for(var day=1;day<=new Date(2026,month.number,0).getDate();day++){
      var date='2026-'+String(month.number).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      var balance=(model.balances||[]).find(function(row){return row.iso===date});
      var cell=panel.querySelector('.day[data-day="'+day+'"]');
      if(cell){var bod=cell.querySelector('.bod b'),eod=cell.querySelector('.eod b');if(bod)bod.textContent=money(balance&&balance.beginning!=null?balance.beginning:previous);if(eod&&balance)eod.textContent=money(balance.balance)}
      if(balance)previous=Number(balance.balance||0);
    }
  }

  function addSummary(panel,month){
    if(!panel||panel.querySelector('.bo-split-summary'))return;
    var rows=(month.rows||[]).filter(function(row){return row.type==='mortgage-split-payment'});
    if(!rows.length)return;
    var summary=document.createElement('div');
    summary.className='bo-split-summary';
    summary.innerHTML='<b>Rocket split payment plan:</b> '+rows.map(function(row){return 'day '+row.day+' '+money(Math.abs(row.amount))+' ('+esc(row.name.replace(/^.* · /,''))+')'}).join(' · ')+'.';
    var header=panel.querySelector('header');
    if(header)header.insertAdjacentElement('afterend',summary);
  }

  async function apply(){
    if(!window.BillsOSCashflow)return false;
    var response=await fetch('/api/bills?splitUi='+Date.now(),{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)return false;
    var data=await response.json();
    var model=window.BillsOSCashflow.build(data,{floorNegative:false});
    Object.keys(SHORT).forEach(function(key){
      var month=model.months&&model.months[key],panel=document.getElementById('panel-'+SHORT[key]);
      if(!month||!panel)return;
      removeOldMortgageRows(panel);
      (month.rows||[]).filter(function(row){return row.type==='mortgage-split-payment'}).forEach(function(row){decorateDay(panel,row)});
      updateDayBalances(panel,month,model);
      setChip(panel,'Starting',month.begin);
      setChip(panel,'Income',(month.rows||[]).filter(function(r){return r.amount>0}).reduce(function(s,r){return s+r.amount},0));
      setChip(panel,'Outflow',(month.rows||[]).filter(function(r){return r.amount<0}).reduce(function(s,r){return s+Math.abs(r.amount)},0));
      setChip(panel,'Ending',month.end);
      addSummary(panel,month);
    });
    window.BillsOSMortgageSplit={loaded:true,paymentSplits:model.paymentSplits||[],engine:model};
    return true;
  }

  function start(){
    addStyles();
    var tries=0;
    (function tick(){apply().then(function(ok){if(!ok&&++tries<120)setTimeout(tick,100)}).catch(function(){if(++tries<120)setTimeout(tick,100)});})();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;

fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
  const output = originalReadFileSync.call(fs, filePath, ...args);
  if (typeof output !== 'string') return output;
  if (path.basename(String(filePath)) !== 'generated-v5.html') return output;
  const cleaned = output.replace(/<script id="billsosMortgageReserveUi">[\s\S]*?<\/script>\s*/i, '');
  if (cleaned.includes('id="billsosMortgageSplitUi"')) return cleaned;
  return cleaned.replace('</body>', splitUiScript + '\n</body>');
};
