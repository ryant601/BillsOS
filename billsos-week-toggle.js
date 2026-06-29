(function(){
  var KEY='billsos-hidden-weeks-v1';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return {}}}
  function save(v){localStorage.setItem(KEY,JSON.stringify(v||{}))}
  function monthKey(){var h=document.querySelector('.monthHead h2');return h?(h.textContent||'').trim():'calendar'}
  function setHidden(cal,week,hidden){cal.querySelectorAll('[data-billsos-week="'+week+'"]').forEach(function(day){day.classList.toggle('week-hidden',hidden)});var btn=cal.querySelector('[data-billsos-week-toggle="'+week+'"]');if(btn){btn.textContent=hidden?'Show week':'Hide week';btn.setAttribute('aria-expanded',hidden?'false':'true')}}
  function weekLabel(index){return 'Week '+(index+1)}
  function resetIfCalendarChanged(cal){var key=monthKey();if(cal.dataset.weekKey&&cal.dataset.weekKey!==key){cal.dataset.weekControls='';cal.querySelectorAll('.weekToggleRow').forEach(function(x){x.remove()});cal.querySelectorAll('[data-billsos-week]').forEach(function(x){x.classList.remove('week-hidden');delete x.dataset.billsosWeek})}cal.dataset.weekKey=key}
  function apply(){var cal=document.querySelector('.cal');if(!cal)return;resetIfCalendarChanged(cal);if(cal.dataset.weekControls==='1')return;var children=[].slice.call(cal.children).filter(function(x){return x.classList&&x.classList.contains('day')});if(!children.length)return;cal.dataset.weekControls='1';var key=monthKey(),state=read(),hiddenMap=state[key]||{};for(var i=0,week=0;i<children.length;i+=7,week++){var group=children.slice(i,i+7);group.forEach(function(day){day.dataset.billsosWeek=week});var row=document.createElement('div');row.className='weekToggleRow';var label=document.createElement('span');label.textContent=weekLabel(week);var btn=document.createElement('button');btn.type='button';btn.className='weekToggleBtn';btn.dataset.billsosWeekToggle=week;row.appendChild(label);row.appendChild(btn);cal.insertBefore(row,group[0]);btn.onclick=function(){var w=this.dataset.billsosWeekToggle,all=read();all[key]=all[key]||{};all[key][w]=!all[key][w];save(all);setHidden(cal,w,!!all[key][w])};setHidden(cal,week,!!hiddenMap[week])}}
  function start(){apply();setInterval(apply,600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
