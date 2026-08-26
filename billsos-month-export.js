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

(function(){
  'use strict';
  var AMOUNT_KEY='billsos-amount-adjust-v1';
  var timer=0;
  var busy=false;

  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim()}
  function money(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0})}
  function moneyCents(v){return Number(v||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})}
  function parseMoney(v){var n=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function readMap(){try{var map=JSON.parse(localStorage.getItem(AMOUNT_KEY)||'{}');return map&&typeof map==='object'&&!Array.isArray(map)?map:{}}catch(e){return {}}}
  function amountFromKey(key){var parts=String(key||'').split('|'),n=Number(parts[parts.length-1]);return isFinite(n)?n:0}
  function adjustedAmount(key,map){var base=amountFromKey(key),edit=map&&map[key],abs=edit&&isFinite(Number(edit.amount))?Math.abs(Number(edit.amount)):Math.abs(base);return base<0?-abs:abs}
  function isCalcOnly(ev){return text(ev).toLowerCase().indexOf('billsos action log')>=0}
  function dayNumber(day){var n=day&&day.querySelector&&day.querySelector('.topline span:first-child b,.topline b');return Number(text(n)||0)}
  function visibleMonth(){var h=text(document.querySelector('.monthHead h2')).toLowerCase(),months={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};for(var k in months){if(h.indexOf(k)>=0)return {name:k,num:months[k]}}return null}
  function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
  function startNode(day){return day&&day.querySelector&&day.querySelector('.topline span:last-child b')}
  function endNode(day){return day&&day.querySelector&&day.querySelector('.endline b')}
  function eventRows(day){return Array.prototype.slice.call(day.querySelectorAll('.ev')).filter(function(ev){return !isCalcOnly(ev)&&ev.querySelector('input[data-id]')})}
  function applyEventAmount(ev,amount,edited){
    var display=moneyCents(Math.abs(amount));
    var btn=ev.querySelector('.amountEditBtn');
    var strong=ev.querySelector('b:not(.ignoreAmount)');
    if(btn&&!btn.dataset.amountKey)setText(btn,display);
    if(strong&&strong!==btn)setText(strong,display);
    ev.classList.toggle('amount-edited',!!edited);
  }
  function refreshDrawerForSelected(){
    var selected=document.querySelector('.day.selected'),sub=document.getElementById('detailSub');
    if(!selected||!sub)return;
    var start=text(startNode(selected))||'—',end=text(endNode(selected))||'—';
    sub.textContent=sub.textContent.replace(/Starting .+ · Ending .+/,'Starting '+start+' · Ending '+end);
  }
  function recalc(){
    if(busy)return;
    var mount=document.getElementById('mount');
    var month=visibleMonth();
    if(!mount||!month)return;
    var days=Array.prototype.slice.call(mount.querySelectorAll('.day:not(.blank)')).filter(function(day){return !!dayNumber(day)}).sort(function(a,b){return dayNumber(a)-dayNumber(b)});
    if(!days.length)return;
    busy=true;
    try{
      var map=readMap();
      var kbegin=document.getElementById('kbegin'),kin=document.getElementById('kin'),kout=document.getElementById('kout'),kend=document.getElementById('kend'),ksweep=document.getElementById('ksweep'),kopen=document.getElementById('kopen');
      var anchor=parseMoney(text(kbegin)||text(startNode(days[0])));
      var running=anchor,income=0,outflow=0,sweep=0,open=0,total=0,done=0;
      days.forEach(function(day){
        var n=dayNumber(day);
        setText(startNode(day),money(running));
        var delta=0;
        eventRows(day).forEach(function(ev){
          var input=ev.querySelector('input[data-id]'),key=input&&input.getAttribute('data-id');
          if(!key)return;
          var amt=adjustedAmount(key,map),edited=!!(map[key]&&isFinite(Number(map[key].amount)));
          applyEventAmount(ev,amt,edited);
          delta+=amt;
          total++;
          if(input.checked||ev.classList.contains('done'))done++;
          if(amt>0)income+=amt;else{outflow+=Math.abs(amt);if(!input.checked&&!ev.classList.contains('done'))open++;if(/sweep/i.test(key)||/sweep/i.test(text(ev)))sweep+=Math.abs(amt)}
        });
        running+=delta;
        setText(endNode(day),money(running));
      });
      setText(kbegin,money(anchor));
      setText(kin,money(income));
      setText(kout,money(outflow));
      setText(kend,money(running));
      setText(ksweep,money(sweep));
      if(kopen)setText(kopen,String(open));
      var progress=document.querySelector('.progress');
      if(progress){
        var b=progress.querySelectorAll('b'),bar=progress.querySelector('.bar i');
        if(b[0])setText(b[0],String(done));
        if(b[1])setText(b[1],String(total));
        if(bar)bar.style.width=(total?Math.round(done/total*100):0)+'%';
      }
      refreshDrawerForSelected();
    }catch(e){}finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(recalc,80)}
  if(!window.__billsosAmountBalanceLocalStoragePatch){
    window.__billsosAmountBalanceLocalStoragePatch=true;
    var nativeSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){var result=nativeSet.apply(this,arguments);if(key===AMOUNT_KEY)setTimeout(schedule,0);return result};
  }
  window.BillsOSRecalculateVisibleBalances=recalc;
  document.addEventListener('click',schedule,true);
  document.addEventListener('change',schedule,true);
  window.addEventListener('load',schedule);
  window.addEventListener('hashchange',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  setTimeout(schedule,300);
  setTimeout(schedule,1200);
  setInterval(schedule,2000);
  try{new MutationObserver(schedule).observe(document.getElementById('mount')||document.documentElement,{subtree:true,childList:true,characterData:true})}catch(e){}
})();

(function(){
  if(document.getElementById('billsosDueDateEditorJs'))return;
  var script=document.createElement('script');
  script.id='billsosDueDateEditorJs';
  script.src='/billsos-due-date-editor.js?v=20260706due1';
  script.defer=true;
  document.head.appendChild(script);
})();
