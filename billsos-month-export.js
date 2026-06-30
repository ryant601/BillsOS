(function(){
  'use strict';
  var BUILD='month-export-20260630-1';
  var printNode=null;

  function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
  function esc(v){return String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function money(v){var n=Number(String(v||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));if(!isFinite(n))n=0;return (n<0?'−':'')+'$'+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0})}
  function parseAmount(text){var n=Number(String(text||'').replace(/[−–—]/g,'-').replace(/[^0-9.-]/g,''));return isFinite(n)?n:0}
  function monthTitle(){var h=document.querySelector('.monthHead h2');return clean(h&&h.textContent)||'Monthly Calendar'}
  function isHidden(el){return el.classList.contains('blank')||el.classList.contains('week-hidden')||el.offsetParent===null}
  function eventName(ev){var span=ev.querySelector('span:not(.dot)')||ev.querySelector('.nm')||ev;return clean(span.textContent).replace(/\$[0-9,]+(?:\.\d{1,2})?/g,'').replace(/⋯/g,'').replace(/^\s*[✓○]\s*/,'').trim()}
  function eventType(ev){var text=(ev.textContent||''),cls=ev.className||'';if(/\bin\b|paycheck|income/i.test(cls+' '+text))return 'Income';if(/system|transfer|funding|sweep/i.test(cls+' '+text))return 'Transfer';if(/auto/i.test(cls+' '+text))return 'Autopay';return 'Action'}
  function readMonth(){
    var title=monthTitle(),days=[];
    document.querySelectorAll('.cal .day').forEach(function(day){
      if(isHidden(day))return;
      var numNode=day.querySelector('.topline span:first-child b')||day.querySelector('.topline b');
      var dayNum=Number(clean(numNode&&numNode.textContent));
      if(!dayNum)return;
      var starting=clean((day.querySelector('.topline span:last-child b')||{}).textContent||'');
      var ending=clean((day.querySelector('.endline b')||{}).textContent||'');
      var items=[];
      day.querySelectorAll('.ev').forEach(function(ev){
        if((ev.textContent||'').indexOf('BillsOS action log')>=0)return;
        var b=ev.querySelector('b:last-child')||ev.querySelector('b,.amt');
        var amount=parseAmount(b&&b.textContent);
        var name=eventName(ev);
        if(!name)return;
        items.push({name:name,amount:amount,type:eventType(ev),done:/\bdone\b/.test(ev.className||'')});
      });
      days.push({day:dayNum,starting:starting,ending:ending,items:items});
    });
    return {title:title,days:days};
  }
  function totals(model){
    var income=0,outflow=0,open=0,complete=0;
    model.days.forEach(function(d){d.items.forEach(function(i){if(i.amount>0)income+=i.amount;else outflow+=Math.abs(i.amount);if(i.done)complete++;else if(i.amount<0)open++;});});
    return {income:income,outflow:outflow,open:open,complete:complete};
  }
  function dayHtml(day){
    var itemHtml=day.items.length?day.items.map(function(i){return '<li class="'+(i.done?'done':'')+'"><span><b>'+esc(i.name)+'</b><em>'+esc(i.type)+'</em></span><strong>'+esc(money(i.amount))+'</strong></li>';}).join(''):'<li class="quiet"><span>No actions</span><strong></strong></li>';
    return '<section class="exportDay"><header><b>'+day.day+'</b><span>End '+esc(day.ending||'—')+'</span></header><ul>'+itemHtml+'</ul></section>';
  }
  function buildPrint(model){
    var t=totals(model);
    if(!printNode){printNode=document.createElement('section');printNode.id='billsosMonthExportPrint';document.body.appendChild(printNode)}
    printNode.innerHTML='<div class="exportPage"><header class="exportHead"><div><p>BillsOS monthly action calendar</p><h1>'+esc(model.title)+'</h1></div><div class="exportMeta"><span>Generated '+esc(new Date().toLocaleDateString())+'</span></div></header><section class="exportStats"><div><span>Income</span><b>'+money(t.income)+'</b></div><div><span>Outflow</span><b>'+money(t.outflow)+'</b></div><div><span>Open actions</span><b>'+t.open+'</b></div><div><span>Completed</span><b>'+t.complete+'</b></div></section><main class="exportGrid">'+model.days.map(dayHtml).join('')+'</main></div>';
  }
  function addStyle(){if(document.getElementById('billsos-month-export-style'))return;var style=document.createElement('style');style.id='billsos-month-export-style';style.textContent='@media screen{#billsosMonthExportPrint{display:none!important}.billsosExportBtn{border:1px solid var(--line,#ded6ca)!important;border-radius:13px!important;padding:9px 12px!important;background:var(--card,#fffdf8)!important;color:var(--ink,#17212b)!important;font-weight:800!important;cursor:pointer!important}.billsosExportBtn:hover{filter:brightness(.98)}}@media print{@page{size:letter landscape;margin:.25in}body>*:not(#billsosMonthExportPrint){display:none!important}html,body{background:#fff!important;padding:0!important;margin:0!important;color:#111!important}#billsosMonthExportPrint{display:block!important;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#111!important}.exportPage{padding:0!important}.exportHead{display:flex!important;justify-content:space-between!important;align-items:flex-end!important;border-bottom:1px solid #ccc!important;padding:0 0 7px!important;margin-bottom:7px!important}.exportHead p{margin:0 0 2px!important;text-transform:uppercase!important;letter-spacing:.12em!important;font-size:8px!important;color:#666!important;font-weight:800!important}.exportHead h1{margin:0!important;font-size:22px!important;line-height:1!important;letter-spacing:-.03em!important}.exportMeta{font-size:9px!important;color:#666!important}.exportStats{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:6px!important;margin-bottom:7px!important}.exportStats div{border:1px solid #d7d7d7!important;border-radius:8px!important;padding:5px 7px!important;background:#fafafa!important}.exportStats span{display:block!important;font-size:7px!important;text-transform:uppercase!important;letter-spacing:.1em!important;color:#666!important;font-weight:800!important}.exportStats b{display:block!important;font-size:13px!important;margin-top:1px!important}.exportGrid{display:grid!important;grid-template-columns:repeat(7,1fr)!important;gap:5px!important}.exportDay{border:1px solid #d5d5d5!important;border-radius:7px!important;min-height:91px!important;padding:4px!important;break-inside:avoid!important;overflow:hidden!important}.exportDay header{display:flex!important;justify-content:space-between!important;gap:4px!important;border-bottom:1px solid #eee!important;padding-bottom:2px!important;margin-bottom:3px!important}.exportDay header b{font-size:13px!important}.exportDay header span{font-size:7px!important;color:#666!important;white-space:nowrap!important}.exportDay ul{list-style:none!important;margin:0!important;padding:0!important;display:grid!important;gap:2px!important}.exportDay li{display:flex!important;justify-content:space-between!important;gap:4px!important;font-size:7.8px!important;line-height:1.12!important;border-radius:4px!important;padding:1px 2px!important;background:#f7f7f7!important}.exportDay li b{font-weight:750!important}.exportDay li em{display:block!important;font-style:normal!important;color:#666!important;font-size:6.5px!important}.exportDay li strong{font-size:7.5px!important;white-space:nowrap!important}.exportDay li.done{opacity:.48!important;text-decoration:line-through!important}.exportDay li.quiet{color:#888!important;background:transparent!important}}';document.head.appendChild(style)}
  function addButton(){
    if(document.getElementById('billsosMonthExportBtn'))return;
    var host=document.querySelector('.nav')||document.querySelector('.hero .nav');
    if(!host)return;
    var btn=document.createElement('button');btn.id='billsosMonthExportBtn';btn.type='button';btn.className='billsosExportBtn';btn.textContent='Export PDF';
    btn.onclick=function(){var model=readMonth();if(!model.days.length){alert('No visible calendar month found to export.');return;}buildPrint(model);setTimeout(function(){window.print()},60)};
    host.appendChild(btn);
  }
  function init(){try{addStyle();addButton();window.BillsOSModules=window.BillsOSModules||{};window.BillsOSModules.monthExport={loaded:true,build:BUILD};}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  setTimeout(addButton,800);
  setTimeout(addButton,1800);
})();
