(function(){
  'use strict';
  var BUILD='month-export-pdf-tab-20260702-4';

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function amountFrom(text){var n=Number(String(text||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function amountFromEvent(ev){
    var input=ev&&ev.querySelector&&ev.querySelector('input[data-id]');
    var id=input&&input.dataset&&input.dataset.id;
    if(id&&id.indexOf('|')>=0){
      var parts=id.split('|');
      var n=Number(parts[parts.length-1]);
      if(isFinite(n)&&n!==0)return n;
    }
    var amtNode=ev&&ev.querySelector&&ev.querySelector('b:last-child,.amt');
    return amountFrom(amtNode&&amtNode.textContent);
  }
  function dollarsAbs(v){return '$'+Math.abs(Number(v||0)).toLocaleString(undefined,{maximumFractionDigits:0})}
  function dollarsSigned(v){var n=Number(v||0),sign=n>=0?'+':'−';return sign+dollarsAbs(n)}
  function monthTitle(){var h=document.querySelector('.monthHead h2');return clean(h&&h.textContent)||'Monthly Action List'}
  function eventName(ev){var span=ev.querySelector('span:not(.dot)')||ev.querySelector('.nm')||ev;return clean(span.textContent).replace(/\$[0-9,]+(?:\.\d{1,2})?/g,'').replace(/⋯/g,'').trim()}
  function eventType(ev){var s=(ev.className||'')+' '+(ev.textContent||'');if(/paycheck|income|\bin\b/i.test(s))return 'Income';if(/transfer|funding|sweep|system/i.test(s))return 'Transfer';if(/auto/i.test(s))return 'Autopay';return 'Action'}
  function realDay(day){return day&&day.classList&&!day.classList.contains('blank')}
  function filenameSafe(v){return clean(v).replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')||'BillsOS-Monthly-Action-List'}
  function timestamp(){var d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')}
  function exportTitle(model){return filenameSafe('BillsOS '+model.title+' Action List '+timestamp())}
  function isCalculationOnly(ev){var s=clean(ev&&ev.textContent).toLowerCase();return s.indexOf('billsos action log')>=0||s.indexOf('balance correction')>=0}

  function kpiAmount(id){
    var node=document.getElementById(id);
    if(!node)return null;
    var value=amountFrom(node.textContent);
    return isFinite(value)?Math.abs(value):null;
  }

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
        var name=eventName(ev);
        if(!name)return;
        var amount=amountFromEvent(ev);
        rows.push({day:dayNum,end:end,name:name,type:eventType(ev),amount:amount,done:/\bdone\b/.test(ev.className||'')});
      });
    });
    rows.sort(function(a,b){return a.day-b.day||String(a.name).localeCompare(String(b.name))});
    return {title:title,rows:rows};
  }

  function summary(model){
    var income=0,outflow=0,open=0,done=0;
    model.rows.forEach(function(r){if(r.amount>0)income+=r.amount;else outflow+=Math.abs(r.amount);if(r.done)done++;else if(r.amount<0)open++;});
    var heroIncome=kpiAmount('kin'),heroOutflow=kpiAmount('kout');
    if(heroIncome!==null)income=heroIncome;
    if(heroOutflow!==null)outflow=heroOutflow;
    return {income:income,outflow:outflow,open:open,done:done,total:model.rows.length,source:(heroIncome!==null||heroOutflow!==null)?'dashboard':'rows'};
  }
  function rowHtml(r){
    var flow=r.amount>=0?'in':'out';
    return '<tr class="'+(r.done?'done ':'')+flow+'"><td>'+r.day+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.type)+'</td><td class="amt '+flow+'">'+esc(dollarsSigned(r.amount))+'</td><td>'+esc(r.end||'')+'</td><td>'+(r.done?'Done':'Open')+'</td></tr>';
  }

  function pageCss(){
    return '@page{size:letter portrait;margin:.35in}*{box-sizing:border-box}body{margin:0;background:#eef1ec;color:#17211d;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;background:rgba(245,244,239,.94);border-bottom:1px solid rgba(79,124,104,.18);backdrop-filter:blur(12px)}.toolbar b{font-size:14px}.toolbar span{display:block;color:#607069;font-size:12px;margin-top:2px}.toolbar button{border:1px solid rgba(79,124,104,.26);border-radius:999px;background:#4F7C68;color:#fff;font-weight:800;padding:9px 13px}.exportPage{width:min(8.5in,100%);margin:18px auto;background:#fff;padding:.35in;box-shadow:0 18px 44px rgba(45,66,55,.14)}.exportHead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #b9c4be;margin-bottom:10px;padding-bottom:8px}.exportHead p{margin:0;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#66746f;font-weight:800}.exportHead h1{margin:2px 0 0;font-size:23px;letter-spacing:-.03em}.exportHead span{font-size:10px;color:#66746f}.exportStats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.exportStats div{border:1px solid #d8dfdb;border-radius:8px;padding:6px 8px;background:#f8faf7}.exportStats span{display:block;font-size:8px;text-transform:uppercase;color:#66746f;font-weight:800}.exportStats b{font-size:14px}.exportStats .income b{color:#2F855A}.exportStats .outflow b{color:#C53030}.exportNote{font-size:9px;color:#66746f;margin:-4px 0 8px}.exportTable{width:100%;border-collapse:collapse;font-size:9px}.exportTable th{background:#eef2ef;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#52615b}.exportTable th,.exportTable td{border-bottom:1px solid #e2e8e4;padding:4px 5px;vertical-align:top}.exportTable td:nth-child(1){width:32px;font-weight:800}.exportTable td:nth-child(3),.exportTable td:nth-child(6){width:64px;color:#66746f}.exportTable td:nth-child(4),.exportTable td:nth-child(5){width:70px;text-align:right;white-space:nowrap;font-weight:800}.exportTable tr.in td:first-child{border-left:3px solid #2F855A}.exportTable tr.out td:first-child{border-left:3px solid #C53030}.exportTable .amt.in{color:#2F855A}.exportTable .amt.out{color:#C53030}.exportTable tr.done{opacity:.48;text-decoration:line-through}@media print{body{background:white}.toolbar{display:none!important}.exportPage{width:auto;margin:0;padding:0;box-shadow:none}}';
  }

  function printHtml(model){
    var s=summary(model),title=exportTitle(model),note=s.source==='dashboard'?'<div class="exportNote">Summary totals match the dashboard hero row for this month.</div>':'';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>'+pageCss()+'</style></head><body><div class="toolbar"><div><b>PDF Preview</b><span>Review first. Use the button when you are ready to print, save, or share.</span></div><button type="button" onclick="window.print()">Print / Save PDF</button></div><main class="exportPage"><div class="exportHead"><div><p>BillsOS action list</p><h1>'+esc(model.title)+'</h1></div><span>Generated '+esc(new Date().toLocaleDateString())+'</span></div><div class="exportStats"><div><span>Total</span><b>'+s.total+'</b></div><div><span>Open</span><b>'+s.open+'</b></div><div class="outflow"><span>Outflow</span><b>−'+dollarsAbs(s.outflow)+'</b></div><div class="income"><span>Income</span><b>+'+dollarsAbs(s.income)+'</b></div></div>'+note+'<table class="exportTable"><thead><tr><th>Day</th><th>Action</th><th>Type</th><th>Amount</th><th>Ending</th><th>Status</th></tr></thead><tbody>'+model.rows.map(rowHtml).join('')+'</tbody></table></main></body></html>';
  }

  function openPdfTab(){
    var model=readMonth();
    if(!model.rows.length){alert('No month actions found to export.');return;}
    var win=window.open('', '_blank');
    if(!win){alert('Pop-up blocked. Allow pop-ups for BillsOS, then try again.');return;}
    win.document.open();
    win.document.write(printHtml(model));
    win.document.close();
  }

  function addStyle(){
    if(document.getElementById('billsos-month-export-style'))return;
    var style=document.createElement('style');
    style.id='billsos-month-export-style';
    style.textContent='.billsosExportBtn{border:1px solid var(--line,#ded6ca)!important;border-radius:999px!important;padding:9px 12px!important;background:var(--card,#fffdf8)!important;color:var(--ink,#17212b)!important;font-weight:800!important;cursor:pointer!important;box-shadow:0 7px 18px rgba(45,66,55,.06)!important}.billsosExportBtn:hover{transform:translateY(-1px)}';
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
    btn.textContent='Open PDF';
    btn.title='Open a PDF-ready action list in a new tab';
    btn.onclick=openPdfTab;
    host.appendChild(btn);
  }
  function init(){addStyle();addButton();window.BillsOSModules=window.BillsOSModules||{};window.BillsOSModules.monthExport={loaded:true,build:BUILD,mode:'pdf-preview-tab-manual-print',filename:'month-year-timestamp'}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(addButton,800);
  setTimeout(addButton,1800);
})();