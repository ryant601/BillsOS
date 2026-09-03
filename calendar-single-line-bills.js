(function(){
  'use strict';

  function install(){
    if(document.getElementById('billsosSingleLineBillStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSingleLineBillStyles';
    style.textContent=[
      '.day .events{gap:4px!important}',
      /* Two stacked lines: the name owns a full-width line, the amount sits under it.
         A day cell is ~90px of usable width, which cannot fit a name and a currency
         amount side by side, so sharing one line silently collapsed the name to 0px. */
      '.day .events .ev{display:grid!important;grid-template-columns:13px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:5px!important;row-gap:0!important;align-items:center!important;justify-content:start!important;box-sizing:border-box!important;position:relative!important;min-width:0!important;min-height:35px!important;height:35px!important;max-height:35px!important;padding:3px 4px 3px 7px!important;overflow:hidden!important;contain:layout paint!important;font-size:11.5px!important;line-height:1.15!important}',
      '.day .events .ev>*{min-width:0!important;margin:0!important}',
      /* The check/dot is taken out of the grid flow so the amount line can use the
         pill's full inner width. Only the name is indented past it. */
      '.day .events .ev>.dot{position:absolute!important;left:8px!important;top:12px!important;grid-column:auto!important;grid-row:auto!important;width:5px!important;height:5px!important;margin:0!important;z-index:2!important}',
      '.day .events .ev>.nm{grid-column:1 / -1!important;grid-row:1!important;align-self:end!important;display:block!important;width:100%!important;min-width:0!important;padding-left:11px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:11.5px!important;font-weight:600!important;letter-spacing:-.005em!important;line-height:1.2!important}',
      '.day .events .ev>.amt{grid-column:1 / -1!important;grid-row:2!important;align-self:start!important;display:block!important;width:100%!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;font-size:10.5px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      '.day .events .ev>.flag,.day .events .ev>.note,.day .events .ev>.meta,.day .events .ev>small{display:none!important}',
      '.day .events .ev.billsosCard{grid-template-columns:minmax(0,1fr)!important;column-gap:0!important;min-height:35px!important;height:35px!important;max-height:35px!important;padding:3px 4px 3px 7px!important}',
      '.day .events .ev.billsosCard>.amountEditBtn,.day .events .ev.billsosCard>.billsosEditRestoreBtn,.day .events .ev.billsosCard>.moveBtn{display:none!important;pointer-events:none!important}',
      '.day .events .ev.billsosCard .billsosDoneCheck{position:absolute!important;left:7px!important;top:7px!important;grid-column:auto!important;grid-row:auto!important;width:12px!important;height:12px!important;min-width:12px!important;margin:0!important;padding:0!important;transform:none!important;box-shadow:none!important;accent-color:#c15f3c!important;z-index:2!important}',
      '.day .events .ev.billsosCard .billsosCardBody{grid-column:1 / -1!important;grid-row:1 / span 2!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:stretch!important;gap:0!important;width:100%!important;height:100%!important;min-width:0!important;overflow:hidden!important}',
      '.day .events .ev.billsosCard .billsosCardName{display:block!important;width:100%!important;height:auto!important;min-width:0!important;padding-left:17px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;-webkit-line-clamp:unset!important;font-size:11.5px!important;font-weight:600!important;letter-spacing:-.005em!important;line-height:1.2!important}',
      '.day .events .ev.billsosCard .billsosCardAmount{display:block!important;width:100%!important;height:auto!important;padding-left:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;font-size:10.5px!important;font-weight:650!important;font-variant-numeric:tabular-nums!important;line-height:1.2!important;text-align:left!important}',
      /* Edit and delete float over the right edge so they never steal name width. */
      '.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{position:absolute!important;top:50%!important;grid-column:auto!important;grid-row:auto!important;width:19px!important;height:19px!important;min-width:19px!important;margin:0!important;padding:0!important;border:1px solid rgba(31,30,29,.16)!important;border-radius:6px!important;background:#fff!important;font-size:10px!important;line-height:1!important;transform:translateY(-50%)!important;opacity:0!important;pointer-events:none!important;transition:opacity .12s ease!important;z-index:2!important}',
      '.day .events .ev.billsosCard .billsosCardEditBtn{right:25px!important}',
      '.day .events .ev.billsosCard .billsosCardDeleteBtn{right:4px!important}',
      '.day .events .ev.billsosCard:hover .billsosCardEditBtn,.day .events .ev.billsosCard:hover .billsosCardDeleteBtn,.day .events .ev.billsosCard:focus-within .billsosCardEditBtn,.day .events .ev.billsosCard:focus-within .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important}',
      '.day .events .ev.billsosCard:hover .billsosCardBody,.day .events .ev.billsosCard:focus-within .billsosCardBody{padding-right:48px!important}',
      /* Narrow desktop still packs 7 columns, so ease the type down a step to keep
         the full currency amount from ellipsising. */
      '@media(min-width:901px) and (max-width:1240px){.day .events .ev>.nm,.day .events .ev.billsosCard .billsosCardName{font-size:11px!important}.day .events .ev>.amt,.day .events .ev.billsosCard .billsosCardAmount{font-size:10px!important;letter-spacing:-.01em!important}}',
      /* One-column mobile calendar: cards are full width, so the controls stay visible. */
      '@media(max-width:900px){.day .events{gap:5px!important}.day .events .ev,.day .events .ev.billsosCard{min-height:42px!important;height:42px!important;max-height:42px!important;padding:4px 52px 4px 9px!important}.day .events .ev>.nm,.day .events .ev.billsosCard .billsosCardName{font-size:13px!important;padding-left:21px!important}.day .events .ev>.amt,.day .events .ev.billsosCard .billsosCardAmount{font-size:12px!important}.day .events .ev>.dot{left:10px!important;top:15px!important}.day .events .ev.billsosCard .billsosDoneCheck{left:9px!important;top:10px!important;width:15px!important;height:15px!important;min-width:15px!important}.day .events .ev.billsosCard .billsosCardEditBtn,.day .events .ev.billsosCard .billsosCardDeleteBtn{opacity:1!important;pointer-events:auto!important;width:21px!important;height:21px!important;min-width:21px!important}.day .events .ev.billsosCard .billsosCardEditBtn{right:27px!important}.day .events .ev.billsosCard:hover .billsosCardBody,.day .events .ev.billsosCard:focus-within .billsosCardBody{padding-right:0!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('load',install,{once:true});
})();
