(function(){
  'use strict';
  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      '.day .events{gap:3px!important}',
      '.ev.billsosCard{display:grid!important;grid-template-columns:16px minmax(0,1fr) auto 20px 20px!important;grid-template-rows:1fr!important;column-gap:4px!important;align-items:center!important;min-height:28px!important;height:28px!important;padding:2px 3px!important;overflow:hidden!important}',
      '.ev.billsosCard .billsosDoneCheck{grid-column:1!important;grid-row:1!important;width:15px!important;height:15px!important;min-width:15px!important;margin:0!important}',
      '.ev.billsosCard .billsosCardBody{display:contents!important}',
      '.ev.billsosCard .billsosCardName{grid-column:2!important;grid-row:1!important;display:block!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:11px!important;line-height:1!important}',
      '.ev.billsosCard .billsosCardAmount{grid-column:3!important;grid-row:1!important;display:block!important;white-space:nowrap!important;font-size:11px!important;line-height:1!important;text-align:right!important}',
      '.ev.billsosCard .billsosCardEditBtn{grid-column:4!important;grid-row:1!important;width:20px!important;height:20px!important;min-width:20px!important;margin:0!important}',
      '.ev.billsosCard .billsosCardDeleteBtn{grid-column:5!important;grid-row:1!important;width:20px!important;height:20px!important;min-width:20px!important;margin:0!important}',
      '@media(max-width:900px){.ev.billsosCard{grid-template-columns:17px minmax(0,1fr) auto 22px 22px!important;min-height:30px!important;height:30px!important}.ev.billsosCard .billsosCardName,.ev.billsosCard .billsosCardAmount{font-size:11.5px!important}.ev.billsosCard .billsosCardEditBtn,.ev.billsosCard .billsosCardDeleteBtn{width:22px!important;height:22px!important;min-width:22px!important}}'
    ].join('');
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
})();
