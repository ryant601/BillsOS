(function(){
  'use strict';
  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      '.day .events{gap:4px!important}',
      '.day .events .ev{display:grid!important;grid-template-columns:6px minmax(0,1fr) auto!important;grid-template-rows:1fr!important;column-gap:5px!important;align-items:center!important;box-sizing:border-box!important;min-width:0!important;min-height:28px!important;height:28px!important;max-height:28px!important;padding:2px 5px!important;overflow:hidden!important;contain:layout paint!important;font-size:10.5px!important;line-height:1!important}',
      '.day .events .ev>*{align-self:center!important;min-width:0!important;margin:0!important}',
      '.day .events .ev>.dot{grid-column:1!important;grid-row:1!important;width:5px!important;height:5px!important;margin:0!important;justify-self:center!important}',
      '.day .events .ev>.nm{grid-column:2!important;grid-row:1!important;display:block!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1.1!important}',
      '.day .events .ev>.amt{grid-column:3!important;grid-row:1!important;display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1.1!important;text-align:right!important}',
      '.day .events .ev>.flag,.day .events .ev>.note,.day .events .ev>.meta,.day .events .ev>small{display:none!important}',
      '.day .events .ev.billsosCard{grid-template-columns:12px minmax(0,1fr) 19px 19px!important;column-gap:4px!important;min-height:28px!important;height:28px!important;max-height:28px!important;padding:2px 4px!important}',
      '.ev.billsosCard .billsosDoneCheck{grid-column:1!important;grid-row:1!important;width:11px!important;height:11px!important;min-width:11px!important;margin:0!important;padding:0!important;align-self:center!important;justify-self:center!important;transform:none!important;box-shadow:none!important;accent-color:#1f3a3d!important}',
      '.ev.billsosCard .billsosCardBody{grid-column:2!important;grid-row:1!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;column-gap:7px!important;width:100%!important;height:100%!important;min-width:0!important;overflow:hidden!important}',
      '.ev.billsosCard .billsosCardName{grid-column:1!important;grid-row:1!important;display:block!important;height:auto!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1.1!important}',
      '.ev.billsosCard .billsosCardAmount{grid-column:2!important;grid-row:1!important;display:block!important;height:auto!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1.1!important;text-align:right!important}',
      '.ev.billsosCard .billsosCardEditBtn{grid-column:3!important;grid-row:1!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;font-size:10px!important;align-self:center!important;justify-self:center!important}',
      '.ev.billsosCard .billsosCardDeleteBtn{grid-column:4!important;grid-row:1!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;font-size:11px!important;align-self:center!important;justify-self:center!important}',
      '@media(max-width:900px){.day .events{gap:5px!important}.day .events .ev{grid-template-columns:6px minmax(0,1fr) auto!important;min-height:30px!important;height:30px!important;max-height:30px!important;font-size:11px!important}.day .events .ev>.nm,.day .events .ev>.amt{font-size:11px!important}.day .events .ev.billsosCard{grid-template-columns:13px minmax(0,1fr) 21px 21px!important;min-height:30px!important;height:30px!important;max-height:30px!important}.ev.billsosCard .billsosDoneCheck{width:12px!important;height:12px!important;min-width:12px!important}.ev.billsosCard .billsosCardName,.ev.billsosCard .billsosCardAmount{font-size:11px!important}.ev.billsosCard .billsosCardEditBtn,.ev.billsosCard .billsosCardDeleteBtn{width:21px!important;height:21px!important;min-width:21px!important}}'
    ].join('');
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
})();
