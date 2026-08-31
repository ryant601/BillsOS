(function(){
  'use strict';
  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      '.day .events{gap:2px!important}',
      '.day .events .ev{display:grid!important;grid-template-columns:6px minmax(0,1fr) auto!important;grid-template-rows:1fr!important;column-gap:4px!important;align-items:center!important;min-width:0!important;min-height:24px!important;height:24px!important;padding:1px 4px!important;overflow:hidden!important;font-size:10.5px!important;line-height:1!important}',
      '.day .events .ev>*{align-self:center!important}',
      '.day .events .ev>.dot{grid-column:1!important;grid-row:1!important;width:5px!important;height:5px!important;margin:0!important;justify-self:center!important}',
      '.day .events .ev>.nm{grid-column:2!important;grid-row:1!important;display:flex!important;align-items:center!important;height:100%!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1!important}',
      '.day .events .ev>.amt{grid-column:3!important;grid-row:1!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;height:100%!important;white-space:nowrap!important;font-size:10.5px!important;line-height:1!important;text-align:right!important}',
      '.day .events .ev>.flag{display:none!important}',
      '.day .events .ev.billsosCard{grid-template-columns:13px minmax(0,1fr) auto 19px 19px!important;column-gap:3px!important;min-height:24px!important;height:24px!important;padding:1px 3px!important}',
      '.ev.billsosCard .billsosDoneCheck{appearance:none!important;-webkit-appearance:none!important;grid-column:1!important;grid-row:1!important;width:11px!important;height:11px!important;min-width:11px!important;margin:0!important;padding:0!important;align-self:center!important;justify-self:center!important;border:1.5px solid currentColor!important;border-radius:50%!important;background:rgba(255,255,255,.7)!important;box-shadow:none!important;display:grid!important;place-content:center!important;opacity:.72!important;cursor:pointer!important}',
      '.ev.billsosCard .billsosDoneCheck:hover{transform:none!important;opacity:1!important}',
      '.ev.billsosCard .billsosDoneCheck:checked{background:currentColor!important;border-color:currentColor!important;opacity:.9!important}',
      '.ev.billsosCard .billsosDoneCheck:checked::after{content:""!important;width:4px!important;height:2px!important;border:1.5px solid #fff!important;border-top:none!important;border-right:none!important;transform:rotate(-45deg) translateY(-.5px)!important}',
      '.ev.billsosCard .billsosCardBody{display:contents!important}',
      '.ev.billsosCard .billsosCardName{grid-column:2!important;grid-row:1!important;display:flex!important;align-items:center!important;height:100%!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;line-height:1!important}',
      '.ev.billsosCard .billsosCardAmount{grid-column:3!important;grid-row:1!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;height:100%!important;white-space:nowrap!important;font-size:10.5px!important;line-height:1!important;text-align:right!important}',
      '.ev.billsosCard .billsosCardEditBtn{grid-column:4!important;grid-row:1!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;font-size:10px!important;align-self:center!important;justify-self:center!important}',
      '.ev.billsosCard .billsosCardDeleteBtn{grid-column:5!important;grid-row:1!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;font-size:11px!important;align-self:center!important;justify-self:center!important}',
      '@media(max-width:900px){.day .events .ev{grid-template-columns:6px minmax(0,1fr) auto!important;min-height:26px!important;height:26px!important;font-size:11px!important}.day .events .ev>.nm,.day .events .ev>.amt{font-size:11px!important}.day .events .ev.billsosCard{grid-template-columns:14px minmax(0,1fr) auto 21px 21px!important;min-height:26px!important;height:26px!important}.ev.billsosCard .billsosDoneCheck{width:12px!important;height:12px!important;min-width:12px!important}.ev.billsosCard .billsosCardName,.ev.billsosCard .billsosCardAmount{font-size:11px!important}.ev.billsosCard .billsosCardEditBtn,.ev.billsosCard .billsosCardDeleteBtn{width:21px!important;height:21px!important;min-width:21px!important}}'
    ].join('');
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
})();
