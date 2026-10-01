(function(){
  'use strict';

  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      /* A quieter ledger treatment keeps the month readable without changing its
         fixed-height day cells or the BillsOS-owned busy-day scrollbar. */
      'body.billsos-v2 .month-panel{padding:18px!important;border-color:rgba(26,34,51,.10)!important;background:#fdfcf9!important;box-shadow:0 12px 34px rgba(58,46,35,.07)!important}',
      'body.billsos-v2 .month-panel>header{align-items:flex-end!important;padding:2px 2px 15px!important;margin-bottom:10px!important;border-bottom:1px solid rgba(26,34,51,.09)!important}',
      'body.billsos-v2 .month-panel h1{font-size:clamp(30px,3vw,42px)!important;line-height:.95!important}',
      'body.billsos-v2 .month-panel h1 span{color:var(--mut)!important;font-size:.55em!important;font-family:"Inter",sans-serif!important;font-weight:550!important;letter-spacing:.02em!important}',
      'body.billsos-v2 .month-panel .chip{min-width:108px!important;padding:8px 10px!important;border-radius:10px!important;background:#f7f4ed!important;border-color:rgba(26,34,51,.09)!important}',
      'body.billsos-v2 .month-panel .chip .v{font-size:16px!important}',
      'body.billsos-v2 .dow-row{padding:0 8px!important}',
      'body.billsos-v2 .dow-row span{text-align:left!important;font-size:9.5px!important;letter-spacing:.14em!important}',
      'body.billsos-v2 .day:not(.is-blank){padding:8px!important;border-radius:11px!important;background:#fff!important;box-shadow:0 1px 0 rgba(26,34,51,.03)!important}',
      'body.billsos-v2 .day.is-today{outline:0!important;border-color:rgba(36,64,107,.58)!important;box-shadow:inset 0 3px 0 var(--clay-800),0 4px 14px rgba(36,64,107,.10)!important}',
      'body.billsos-v2 .dtop{align-items:center!important;min-height:25px!important;padding-bottom:3px!important;border-bottom:1px solid rgba(26,34,51,.07)!important}',
      'body.billsos-v2 .dnum{font-family:"Newsreader","Iowan Old Style",Georgia,serif!important;font-size:22px!important;font-weight:600!important;line-height:1!important}',
      'body.billsos-v2 .bod,body.billsos-v2 .eod{font-size:9.5px!important;letter-spacing:.01em!important}',
      'body.billsos-v2 .bod b,body.billsos-v2 .eod b{color:var(--ink)!important;font-variant-numeric:tabular-nums!important}',
      '.day .events{gap:5px!important;margin:5px 0!important}',

      /* Every pill is content-sized. Names wrap without a line clamp and amounts
         keep their own untruncated row. Extra pills scroll inside .events. */
      '.day .events .ev{display:grid!important;grid-template-columns:8px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:5px!important;row-gap:2px!important;align-items:start!important;box-sizing:border-box!important;position:relative!important;min-width:0!important;min-height:44px!important;height:auto!important;max-height:none!important;padding:6px 7px!important;overflow:visible!important;contain:none!important;border-radius:8px!important;font-size:11.5px!important;line-height:1.2!important}',
      '.day .events .ev>*{min-width:0!important;margin:0!important}',
      '.day .events .ev>.dot{grid-column:1!important;grid-row:1!important;width:5px!important;height:5px!important;margin-top:4px!important}',
      '.day .events .ev>.nm{grid-column:2!important;grid-row:1!important;display:block!important;width:100%!important;min-width:0!important;padding:0!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;word-break:normal!important;-webkit-line-clamp:unset!important;font-size:11.5px!important;font-weight:650!important;letter-spacing:-.005em!important;line-height:1.22!important}',
      '.day .events .ev>.amt{grid-column:2!important;grid-row:2!important;display:block!important;width:max-content!important;max-width:100%!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;font-size:11px!important;font-weight:750!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      '.day .events .ev>.flag,.day .events .ev>.note,.day .events .ev>.meta,.day .events .ev>small{display:none!important}',

      /* Editor-enhanced cards use the same complete two-line reading order. */
      '.day .events .ev.billsosCard{display:block!important;min-height:44px!important;height:auto!important;max-height:none!important;padding:6px 7px!important;overflow:visible!important}',
      '.day .events .ev.billsosCard>.amountEditBtn,.day .events .ev.billsosCard>.billsosEditRestoreBtn,.day .events .ev.billsosCard>.moveBtn{display:none!important;pointer-events:none!important}',
      '.day .events .ev.billsosCard .billsosDoneCheck{position:absolute!important;left:7px!important;top:8px!important;width:12px!important;height:12px!important;min-width:12px!important;margin:0!important;padding:0!important;transform:none!important;box-shadow:none!important;accent-color:#24406b!important;z-index:2!important}',
      '.day .events .ev.billsosCard .billsosCardBody{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;width:100%!important;height:auto!important;min-width:0!important;overflow:visible!important}',
      '.day .events .ev.billsosCard .billsosCardName{display:block!important;width:100%!important;height:auto!important;min-width:0!important;padding:0 0 0 17px!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important;word-break:normal!important;-webkit-line-clamp:unset!important;-webkit-box-orient:initial!important;font-size:11.5px!important;font-weight:650!important;letter-spacing:-.005em!important;line-height:1.22!important}',
      '.day .events .ev.billsosCard .billsosCardAmount{display:block!important;width:max-content!important;max-width:100%!important;height:auto!important;padding:0!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;font-size:11px!important;font-weight:750!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      '.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{position:absolute!important;top:5px!important;width:18px!important;height:18px!important;min-width:18px!important;margin:0!important;padding:0!important;border:1px solid rgba(26,34,51,.16)!important;border-radius:5px!important;background:#fff!important;font-size:10px!important;line-height:1!important;transform:none!important;opacity:0!important;pointer-events:none!important;transition:opacity .12s ease!important;z-index:3!important}',
      '.day .events .ev.billsosCard .billsosCardEditBtn{right:25px!important}',
      '.day .events .ev.billsosCard .billsosCardDeleteBtn{right:5px!important}',
      '.day .events .ev.billsosCard:hover .billsosCardEditBtn,.day .events .ev.billsosCard:hover .billsosCardDeleteBtn,.day .events .ev.billsosCard:focus-within .billsosCardEditBtn,.day .events .ev.billsosCard:focus-within .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important}',
      '.day .events .ev.billsosCard:hover .billsosCardName,.day .events .ev.billsosCard:focus-within .billsosCardName{padding-right:42px!important}',

      '.day{container-type:inline-size}',
      '@container (min-width: 230px){.day .events .ev{grid-template-columns:8px minmax(0,1fr) auto!important;grid-template-rows:auto!important;align-items:center!important}.day .events .ev>.dot{grid-column:1!important;grid-row:1!important;margin-top:0!important}.day .events .ev>.nm{grid-column:2!important;grid-row:1!important}.day .events .ev>.amt{grid-column:3!important;grid-row:1!important;text-align:right!important}.day .events .ev.billsosCard .billsosCardBody{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;column-gap:10px!important}.day .events .ev.billsosCard .billsosCardName{grid-column:1!important}.day .events .ev.billsosCard .billsosCardAmount{grid-column:2!important;text-align:right!important}}',
      '@media(max-width:900px){body.billsos-v2 .month-panel{padding:12px!important}body.billsos-v2 .month-panel>header{align-items:flex-start!important}.day .events{gap:6px!important}.day .events .ev,.day .events .ev.billsosCard{min-height:48px!important;padding:7px 9px!important}.day .events .ev>.nm,.day .events .ev.billsosCard .billsosCardName{font-size:13px!important}.day .events .ev>.amt,.day .events .ev.billsosCard .billsosCardAmount{font-size:12.5px!important}.day .events .ev.billsosCard .billsosDoneCheck{left:9px!important;top:9px!important;width:15px!important;height:15px!important;min-width:15px!important}.day .events .ev.billsosCard .billsosCardName{padding-left:21px!important}.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important;width:21px!important;height:21px!important;min-width:21px!important}.day .events .ev.billsosCard .billsosCardEditBtn{right:31px!important}.day .events .ev.billsosCard .billsosCardDeleteBtn{right:7px!important}.day .events .ev.billsosCard .billsosCardName{padding-right:50px!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
})();
