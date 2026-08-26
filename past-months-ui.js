(function(){
  'use strict';
  var KEY='billsos-show-past-months-v1';
  var MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  function preference(){try{return localStorage.getItem(KEY)==='1'}catch(e){return false}}
  function save(value){try{localStorage.setItem(KEY,value?'1':'0')}catch(e){}}
  function currentKey(){var d=new Date();return d.getFullYear()*100+(d.getMonth()+1)}
  function buttonMonthKey(btn){var year=Number(btn&&btn.dataset&&btn.dataset.year||0),name=String(btn&&btn.textContent||'').trim().toLowerCase(),month=MONTHS[name]||0;return year&&month?year*100+month:0}
  function pastButtons(){return Array.from(document.querySelectorAll('#tabs .year-months button[data-year]')).filter(function(btn){var key=buttonMonthKey(btn);return key&&key<currentKey()})}
  function ensureToggle(){var tabs=document.getElementById('tabs');if(!tabs)return null;var button=document.getElementById('past-months-toggle');if(button)return button;button=document.createElement('button');button.id='past-months-toggle';button.type='button';button.className='past-months-toggle';button.setAttribute('aria-pressed','false');button.onclick=function(){save(!preference());apply()};tabs.appendChild(button);return button}
  function apply(){var buttons=pastButtons();if(!buttons.length)return;var show=preference(),toggle=ensureToggle();buttons.forEach(function(btn){btn.classList.toggle('billsos-past-month-hidden',!show);btn.setAttribute('aria-hidden',show?'false':'true')});if(toggle){toggle.textContent=show?'Hide past months':'Show past months ('+buttons.length+')';toggle.setAttribute('aria-pressed',show?'true':'false')};document.documentElement.classList.toggle('billsos-showing-past-months',show)}
  function start(){var tabs=document.getElementById('tabs');if(!tabs)return;apply();var observer=new MutationObserver(function(){apply()});observer.observe(tabs,{childList:true,subtree:true});window.addEventListener('pageshow',apply);window.addEventListener('focus',apply)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
