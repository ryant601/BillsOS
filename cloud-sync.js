(function(){
  var STORE='billsos-completed-events-v1';
  var API='/api/checkmarks';
  var syncing=false;
  var saveTimer=null;

  function readLocal(){
    try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){return {};}
  }
  function writeLocal(obj){
    try{localStorage.setItem(STORE,JSON.stringify(obj||{}));}catch(e){}
  }
  function cleanText(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function eventId(ev){
    var day=ev.closest('.day');
    var panel=ev.closest('.month-panel');
    var month=panel?panel.id.replace('panel-',''):'month';
    var d=day?day.getAttribute('data-day'):'x';
    var nm=cleanText((ev.querySelector('.nm')||{}).textContent||'');
    var amt=cleanText((ev.querySelector('.amt')||{}).textContent||'');
    return month+'|'+d+'|'+nm+'|'+amt;
  }
  function setSyncStatus(text,kind){
    document.querySelectorAll('.saveStatus,.savestatus').forEach(function(el){
      el.textContent=text;
      if(kind==='ok')el.className='saveStatus savestatus ok';
      if(kind==='warn')el.className='saveStatus savestatus warn';
    });
  }
  function currentFromDom(){
    var out=readLocal();
    document.querySelectorAll('.month-panel .ev input[type="checkbox"]').forEach(function(box){
      var ev=box.closest('.ev');
      if(!ev)return;
      var id=eventId(ev);
      if(box.checked)out[id]=1; else delete out[id];
    });
    return out;
  }
  function applyToDom(completed){
    document.querySelectorAll('.month-panel .ev input[type="checkbox"]').forEach(function(box){
      var ev=box.closest('.ev');
      if(!ev)return;
      var checked=!!completed[eventId(ev)];
      if(box.checked!==checked){
        box.checked=checked;
        ev.classList.toggle('done',checked);
        box.dispatchEvent(new Event('change',{bubbles:true}));
      }else{
        ev.classList.toggle('done',checked);
      }
    });
  }
  async function pushCloud(){
    if(syncing)return;
    syncing=true;
    try{
      var completed=currentFromDom();
      writeLocal(completed);
      setSyncStatus('Syncing to cloud…','warn');
      var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({completed:completed})});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json();
      if(data&&data.completed)writeLocal(data.completed);
      setSyncStatus('Synced to cloud','ok');
    }catch(e){
      setSyncStatus('Saved on this device · cloud offline','warn');
    }finally{
      syncing=false;
    }
  }
  function queuePush(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(pushCloud,350);
  }
  async function pullCloud(){
    try{
      setSyncStatus('Loading cloud sync…','warn');
      var r=await fetch(API,{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      var data=await r.json();
      var cloud=(data&&data.completed)||{};
      var local=readLocal();
      var merged=Object.assign({},cloud,local);
      writeLocal(merged);
      applyToDom(merged);
      setSyncStatus('Synced to cloud','ok');
      await pushCloud();
    }catch(e){
      setSyncStatus('Saved on this device · cloud offline','warn');
    }
  }
  function waitForCalendar(){
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(document.querySelector('.month-panel .ev input[type="checkbox"]')){
        clearInterval(t);
        pullCloud();
      }
      if(tries>80)clearInterval(t);
    },250);
  }
  document.addEventListener('change',function(e){
    if(e.target&&e.target.matches&&e.target.matches('.month-panel .ev input[type="checkbox"]'))queuePush();
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitForCalendar);else waitForCalendar();
})();
