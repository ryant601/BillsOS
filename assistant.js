(function(){
  'use strict';
  function css(){
    if(document.getElementById('billsos-assistant-style'))return;
    var s=document.createElement('style');
    s.id='billsos-assistant-style';
    s.textContent='.assistant-panel{display:none!important}.billsos-ai-fab{position:fixed;right:18px;bottom:18px;z-index:9999;border:0;border-radius:999px;background:#14202c;color:#fff;padding:13px 16px;box-shadow:0 16px 38px rgba(20,35,55,.32);font:800 13px system-ui;display:flex;gap:9px;align-items:center;cursor:pointer}.billsos-ai-fab:hover{background:#203040}.billsos-ai-dot{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.16)}.billsos-ai-backdrop{position:fixed;inset:0;background:rgba(8,14,22,.24);z-index:9997;display:none}.billsos-ai-backdrop.open{display:block}.billsos-ai-sheet{position:fixed;right:18px;bottom:84px;width:min(520px,calc(100vw - 28px));height:min(720px,calc(100vh - 110px));z-index:9998;background:#fff;border:1px solid rgba(20,35,55,.14);border-radius:24px;box-shadow:0 24px 70px rgba(20,35,55,.28);overflow:hidden;display:none}.billsos-ai-sheet.open{display:block}.billsos-ai-top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 16px;border-bottom:1px solid rgba(20,35,55,.1);font:800 14px system-ui;color:#14202c}.billsos-ai-close{border:1px solid rgba(20,35,55,.12);background:#fff;color:#41505f;border-radius:999px;width:30px;height:30px;font-size:18px;line-height:1;cursor:pointer}.billsos-ai-frame{width:100%;height:calc(100% - 49px);border:0}@media(max-width:760px){.billsos-ai-sheet{left:0;right:0;bottom:0;width:auto;height:84vh;border-radius:24px 24px 0 0}.billsos-ai-fab{right:14px;bottom:14px}}';
    document.head.appendChild(s);
  }
  function close(){var b=document.getElementById('billsosAiBackdrop'),p=document.getElementById('billsosAiSheet'),f=document.getElementById('billsosAiFab');if(b)b.classList.remove('open');if(p)p.classList.remove('open');if(f)f.setAttribute('aria-expanded','false');}
  function open(){var b=document.getElementById('billsosAiBackdrop'),p=document.getElementById('billsosAiSheet'),f=document.getElementById('billsosAiFab');if(b)b.classList.add('open');if(p)p.classList.add('open');if(f)f.setAttribute('aria-expanded','true');}
  function init(){
    css();
    if(document.getElementById('billsosAiFab'))return;
    var backdrop=document.createElement('div');backdrop.id='billsosAiBackdrop';backdrop.className='billsos-ai-backdrop';backdrop.addEventListener('click',close);
    var sheet=document.createElement('section');sheet.id='billsosAiSheet';sheet.className='billsos-ai-sheet';sheet.setAttribute('aria-label','BillsOS Assistant');sheet.innerHTML='<div class="billsos-ai-top"><span>BillsOS Assistant</span><button class="billsos-ai-close" id="billsosAiClose" type="button" aria-label="Close">×</button></div><iframe class="billsos-ai-frame" src="/assistant.html?v=20260629bubble1" title="BillsOS Assistant"></iframe>';
    var fab=document.createElement('button');fab.id='billsosAiFab';fab.className='billsos-ai-fab';fab.type='button';fab.setAttribute('aria-expanded','false');fab.innerHTML='<span class="billsos-ai-dot">💬</span><span>Ask BillsOS</span>';
    document.body.appendChild(backdrop);document.body.appendChild(sheet);document.body.appendChild(fab);
    fab.addEventListener('click',function(){sheet.classList.contains('open')?close():open();});
    document.getElementById('billsosAiClose').addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
