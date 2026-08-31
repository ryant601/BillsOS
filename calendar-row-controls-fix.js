(function(){
  'use strict';
  var KEY='billsos-hidden-weeks-v2';

  function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_e){return {}}}
  function saveState(value){try{localStorage.setItem(KEY,JSON.stringify(value||{}))}catch(_e){}}
  function monthKey(host){var h=host&&(host.querySelector('.monthHead h2')||host.querySelector('header h1'));return h?String(h.textContent||'').trim():'calendar'}
  function stateKey(host,week){return monthKey(host)+'|'+week}

  function installStyles(){
    if(document.getElementById('billsosRowControlsFixStyle'))return;
    var style=document.createElement('style');
    style.id='billsosRowControlsFixStyle';
    style.textContent='.grid.weekCollapseGrid,.cal.weekCollapseGrid{grid-template-columns:repeat(7,minmax(0,1fr))!important}.grid.weekCollapseGrid>.day,.cal.weekCollapseGrid>.day{min-width:0!important;width:auto!important}.weekToggleRow{min-width:0!important;width:auto!important}.weekToggleRow>span{min-width:0}.weekToggleStatus{display:none!important}';
    document.head.appendChild(style);
  }

  function rowWeek(row){
    var node=row&&row.nextElementSibling;
    while(node&&!node.classList.contains('weekToggleRow')){
      if(node.classList.contains('day')&&node.dataset&&node.dataset.billsosWeek)return node.dataset.billsosWeek;
      node=node.nextElementSibling;
    }
    return '';
  }

  function setHidden(host,row,week,hidden,persist){
    var cal=row&&row.parentElement;if(!cal||!week)return;
    cal.querySelectorAll('[data-billsos-week="'+week+'"]').forEach(function(day){day.classList.toggle('week-hidden',!!hidden)});
    var button=row.querySelector('.weekToggleBtn');
    if(button){button.textContent=hidden?'Show row':'Hide row';button.setAttribute('aria-expanded',hidden?'false':'true')}
    if(persist){var state=readState();state[stateKey(host,week)]=!!hidden;saveState(state)}
  }

  function ensureButton(host,row){
    if(!row||row.querySelector('.weekToggleBtn'))return;
    var week=rowWeek(row);if(!week)return;
    var label=row.querySelector('span:not(.weekToggleStatus)');
    var button=document.createElement('button');
    button.type='button';button.className='weekToggleBtn';button.dataset.billsosWeekToggle=week;
    button.dataset.billsosRowLabel=label?String(label.textContent||'').trim():'calendar row';
    row.insertBefore(button,label||row.firstChild);
    var state=readState(),key=stateKey(host,week),hidden=Object.prototype.hasOwnProperty.call(state,key)?!!state[key]:false;
    button.onclick=function(){var next=this.getAttribute('aria-expanded')!=='false';setHidden(host,row,week,next,true)};
    setHidden(host,row,week,hidden,false);
  }

  function install(){
    installStyles();
    document.querySelectorAll('.month-panel,.month-shell,.calendarWrap').forEach(function(host){
      host.querySelectorAll('.weekToggleRow').forEach(function(row){ensureButton(host,row)});
      var bulk=host.querySelector('.weekToggleAllBtn');
      if(bulk){var buttons=[].slice.call(host.querySelectorAll('.weekToggleBtn')),allHidden=buttons.length&&buttons.every(function(button){return button.getAttribute('aria-expanded')==='false'});bulk.textContent=allHidden?'Expand rows':'Collapse rows';bulk.setAttribute('aria-label',bulk.textContent+' in '+monthKey(host))}
    });
  }

  function boot(){install();var tries=0,t=setInterval(function(){tries++;install();if(tries>=16)clearInterval(t)},125)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',install);
  document.addEventListener('click',function(){setTimeout(install,0)},true);
})();
