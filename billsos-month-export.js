(function(){
  'use strict';
  var BUILD='month-export-list-20260702-1';
  var printNode=null;
  var previousTitle=null;

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function amountFrom(text){var n=Number(String(text||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function dollars(v){var n=Number(v||0);return (n<0?'-':'')+'$'+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}
  function monthTitle(){var h=document.querySelector('.monthHead h2');return clean(h&&h.textContent)||'Monthly Action List'}
  function eventName(ev){var span=ev.querySelector('span:not(.dot)')||ev.querySelector('.nm')||ev;return clean(span.textContent).replace(/\$[0-9,]+(?:\.\d{1,2})?/g,'').replace(/⋯/g,'').trim()}
  function eventType(ev){var s=(ev.className||'')+' '+(ev.textContent||'');if(/paycheck|income|\bin\b/i.test(s))return 'Income';if(/transfer|funding|sweep|system/i.test(s))return 'Transfer';if(/auto/i.test(s))return 'Autopay';return 'Action'}
  function realDay(day){return day&&day.classList&&!day.classList.contains('blank')}
  function filenameSafe(v){return clean(v).replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'BillsOS-Monthly-Action-List'}
  function timestamp(){var d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')}
  function exportTitle(model){return filenameSafe('BillsOS '+model.title+' Action List '+timestamp())}
  function preparePrintTitle(model){previousTitle=document.title;document.title=exportTitle(model)}
  function restorePrintTitle(){if(previousTitle!=null){document.title=previousTitle;previousTitle=null}}
  function isCalculationOnly(ev){var s=clean(ev&&ev.textContent).toLowerCase();return s.indexOf('billsos action log')>=0||s.indexOf('balance correction')>=0}

  function readMonth(){
    var rows=[],title=monthTitle();
    document.querySelectorAll('.cal .day').forEach(function(day){
      if(!realDay(day))return;
      var numNode=day.querySelector('.topline span:first-child b')||day.querySelector('.topline b');
      var dayNum=Number(clean(numNode&&numNode.textContent));
      if(!dayNum)return;
      var end=clean((day.querySelector('.endline b')||{}).textContent||'');
      day.querySelectorAll('.ev').forEach(function(ev){
        if(isCalculationOnly(ev))return;
        var amtNode=ev.querySelector('b:last-child')||ev.querySelector('b,.amt');
        var name=eventName(ev);
        if(!name)return;
        rows.push({day:dayNum,end:end,name:name,type:eventType(ev),amount:amountFrom(amtNode&&amtNode.textContent),done:/\bdone\b/.test(ev.className||'')});
      });
    });
    rows.sort(function(a,b){return a.day-b.day||String(a.name).localeCompare(String(b.name))});
    return {title:title,rows:rows};
  }

  function summary(model){
    var income=0,outflow=0,open=0,done=0;
    model.rows.forEach(function(r){if(r.amount>0)income+=r.amount;else outflow+=Math.abs(r.amount);if(r.done)done++;else if(r.amount<0)open++;});
    return {income:income,outflow:outflow,open:open,done:done,total:model.rows.length};
  }
  function rowHtml(r){
    return '<tr class="'+(r.done?'done':'')+'"><td>'+r.day+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.type)+'</td><td>'+esc(dollars(r.amount))+'</td><td>'+esc(r.end||'')+'</td><td>'+(r.done?'Done':'Open')+'</td></tr>';
  }
  function buildPrint(model){
    var s=summary(model);
    if(!printNode){printNode=document.createElement('section');printNode.id='billsosMonthExportPrint';document.body.appendChild(printNode)}
    printNode.innerHTML='<div class="exportPage"><div class="exportHead"><div><p>BillsOS action list</p><h1>'+esc(model.title)+'</h1></div><span>Generated '+esc(new Date().toLocaleDateString())+'</span></div><div class="exportStats"><div><span>Total</span><b>'+s.total+'</b></div><div><span>Open</span><b>'+s.open+'</b></div><div><span>Outflow</span><b>'+dollars(s.outflow)+'</b></div><div><span>Income</span><b>'+dollars(s.income)+'</b></div></div><table class="exportTable"><thead><tr><th>Day</th><th>Action</th><th>Type</th><th>Amount</th><th>Ending</th><th>Status</th></tr></thead><tbody>'+model.rows.map(rowHtml).join('')+'</tbody></table></div>';
  }

  function addStyle(){
    if(document.getElementById('billsos-month-export-style'))return;
    var style=document.createElement('style');
    style.id='billsos-month-export-style';
    style.textContent='@media screen{#billsosMonthExportPrint{display:none!important}.billsosExportBtn{border:1px solid var(--line,#ded6ca)!important;border-radius:13px!important;padding:9px 12px!important;background:var(--card,#fffdf8)!important;color:var(--ink,#17212b)!important;font-weight:800!important;cursor:pointer!important}}@media print{@page{size:letter portrait;margin:.35in}body>*:not(#billsosMonthExportPrint){display:none!important}html,body{background:white!important;margin:0!important;padding:0!important;color:#111!important}#billsosMonthExportPrint{display:block!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important}.exportHead{display:flex!important;justify-content:space-between!important;align-items:flex-end!important;border-bottom:1px solid #bbb!important;margin-bottom:10px!important;padding-bottom:8px!important}.exportHead p{margin:0!important;font-size:9px!important;text-transform:uppercase!important;letter-spacing:.12em!important;color:#666!important;font-weight:800!important}.exportHead h1{margin:2px 0 0!important;font-size:23px!important}.exportHead span{font-size:10px!important;color:#666!important}.exportStats{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:8px!important;margin-bottom:10px!important}.exportStats div{border:1px solid #ddd!important;border-radius:8px!important;padding:6px 8px!important;background:#fafafa!important}.exportStats span{display:block!important;font-size:8px!important;text-transform:uppercase!important;color:#666!important;font-weight:800!important}.exportStats b{font-size:14px!important}.exportTable{width:100%!important;border-collapse:collapse!important;font-size:9px!important}.exportTable th{background:#f1f1f1!important;text-align:left!important;font-size:8px!important;text-transform:uppercase!important;letter-spacing:.08em!important;color:#555!important}.exportTable th,.exportTable td{border-bottom:1px solid #e2e2e2!important;padding:4px 5px!important;vertical-align:top!important}.exportTable td:nth-child(1){width:32px!important;font-weight:800!important}.exportTable td:nth-child(3),.exportTable td:nth-child(6){width:64px!important;color:#666!important}.exportTable td:nth-child(4),.exportTable td:nth-child(5){width:70px!important;text-align:right!important;white-space:nowrap!important;font-weight:800!important}.exportTable tr.done{opacity:.48!important;text-decoration:line-through!important}}';
    document.head.appendChild(style);
  }
  function addButton(){
    if(document.getElementById('billsosMonthExportBtn'))return;
    var host=document.querySelector('.nav')||document.querySelector('.hero .nav');
    if(!host)return;
    var btn=document.createElement('button');
    btn.id='billsosMonthExportBtn';
    btn.type='button';
    btn.className='billsosExportBtn';
    btn.textContent='Export List';
    btn.onclick=function(){var model=readMonth();if(!model.rows.length){alert('No month actions found to export.');return;}buildPrint(model);preparePrintTitle(model);setTimeout(function(){window.print();setTimeout(restorePrintTitle,1200)},60)};
    host.appendChild(btn);
  }
  function init(){addStyle();addButton();window.BillsOSModules=window.BillsOSModules||{};window.BillsOSModules.monthExport={loaded:true,build:BUILD,mode:'list-all-weeks',filename:'month-year-timestamp'}}
  window.addEventListener('afterprint',restorePrintTitle);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(addButton,800);
  setTimeout(addButton,1800);
})();
