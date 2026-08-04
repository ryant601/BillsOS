'use strict';

const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

function upsertScript(html, script) {
  const match = script.match(/src="([^"]+)/);
  if (!match) return html;
  const src = match[1].split('?')[0];
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp('<script[^>]+src=["\\\']' + escaped + '[^"\\\']*["\\\'][^>]*><\\/script>', 'i');
  if (existing.test(html)) return html.replace(existing, script);
  return html.replace('</body>', script + '\n</body>');
}

const safePreview = String.raw`<script id="billsosSafePreview">
(function(){
  'use strict';
  if(window.__billsosSafePreview)return;
  window.__billsosSafePreview=true;

  function addStyles(){
    if(document.getElementById('billsosSafePreviewStyles'))return;
    var style=document.createElement('style');
    style.id='billsosSafePreviewStyles';
    style.textContent=[
      ':root{--bg:#eef3ec!important;--card:#fff!important;--ink:#1f2b26!important;--mut:#68766e!important;--line:rgba(73,111,91,.15)!important;--primary:#496f5b!important;--green:#3d7556!important;--red:#b65e52!important;--out:#b65e52!important;--gold:#8b6a1f!important}',
      'html{background:#eef3ec}body.billsos-preview{background:linear-gradient(135deg,#eef3ec 0%,#f8faf6 52%,#e7efe6 100%)!important;color:#1f2b26!important;font-family:Manrope,"Avenir Next","Segoe UI",sans-serif!important}',
      '.billsos-preview-sidebar{position:fixed;inset:0 auto 0 0;width:226px;z-index:80;display:flex;flex-direction:column;padding:22px 15px 16px;background:rgba(247,250,246,.97);border-right:1px solid rgba(73,111,91,.14);box-shadow:8px 0 32px rgba(52,88,70,.06);backdrop-filter:blur(18px)}',
      '.billsos-preview-brand{display:flex;align-items:center;gap:11px;padding:4px 8px 22px}.billsos-preview-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:#345846;color:#fff;font-size:18px;font-weight:900;box-shadow:0 9px 24px rgba(52,88,70,.22)}.billsos-preview-brand strong{display:block;font-size:19px;letter-spacing:-.04em}.billsos-preview-brand small{display:block;margin-top:2px;color:#68766e;font-size:10px;font-weight:700}',
      '.billsos-preview-nav{display:grid;gap:5px}.billsos-preview-nav a,.billsos-preview-nav button{width:100%;display:flex;align-items:center;gap:11px;border:0;border-radius:12px;padding:11px 12px;background:transparent;color:#425047;text-decoration:none;font:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer}.billsos-preview-nav a:hover,.billsos-preview-nav button:hover{background:#e8f0e6;color:#1f3b30}.billsos-preview-nav .is-active{background:#d9e7d7;color:#1f3b30;box-shadow:inset 0 0 0 1px rgba(73,111,91,.08)}.billsos-preview-icon{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:rgba(73,111,91,.09);font-size:14px;font-weight:900}.billsos-preview-divider{height:1px;margin:12px 8px;background:rgba(73,111,91,.12)}',
      '.billsos-preview-footer{margin-top:auto;padding:14px 8px 2px;border-top:1px solid rgba(73,111,91,.12);color:#496f5b;font-size:11px;font-weight:750}',
      'body.billsos-preview>.wrap{max-width:none!important;margin-left:226px!important;padding-left:22px!important;padding-right:22px!important}',
      'body.billsos-preview .pill{display:none!important}body.billsos-preview .hero,body.billsos-preview .top{border-color:rgba(73,111,91,.11)!important;background:rgba(255,255,255,.88)!important;box-shadow:0 14px 38px rgba(52,88,70,.08)!important}body.billsos-preview .hero .nav,body.billsos-preview .top>.nav{display:none!important}',
      'body.billsos-preview .month-panel,body.billsos-preview .card{border-color:rgba(73,111,91,.12)!important;background:rgba(255,255,255,.91)!important;box-shadow:0 14px 38px -28px rgba(52,88,70,.45)!important}',
      'body.billsos-preview .tabs{border-color:rgba(73,111,91,.10)!important;background:rgba(255,255,255,.72)!important}body.billsos-preview .tab.active,body.billsos-preview .tabs button.active{background:#345846!important;color:#fff!important}',
      'body.billsos-preview input,body.billsos-preview select,body.billsos-preview textarea{border-color:rgba(73,111,91,.18)!important}body.billsos-preview input:focus,body.billsos-preview select:focus,body.billsos-preview textarea:focus{outline:2px solid rgba(73,111,91,.20)!important;border-color:#496f5b!important}',
      'body.billsos-preview .btn.primary{background:#345846!important;border-color:#345846!important;color:#fff!important}body.billsos-preview th{background:#f7faf6!important}',
      '#billsosPreviewMenu{display:none;position:fixed;left:12px;top:12px;z-index:100;width:42px;height:42px;border:1px solid rgba(73,111,91,.16);border-radius:13px;background:#fff;color:#1f3b30;font-size:20px;box-shadow:0 10px 28px rgba(52,88,70,.18)}#billsosPreviewScrim{display:none}',
      '@media(max-width:760px){body.billsos-preview>.wrap{margin-left:0!important;padding:62px 9px 28px!important}.billsos-preview-sidebar{width:min(82vw,290px);transform:translateX(-105%);transition:transform .2s ease}.billsos-preview-open .billsos-preview-sidebar{transform:translateX(0)}#billsosPreviewMenu{display:grid;place-items:center}.billsos-preview-open #billsosPreviewScrim{display:block;position:fixed;inset:0;z-index:70;background:rgba(31,43,38,.28);backdrop-filter:blur(2px)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function addFont(){
    if(document.getElementById('billsosPreviewFont'))return;
    var link=document.createElement('link');link.id='billsosPreviewFont';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';document.head.appendChild(link);
  }

  function item(icon,label,href,active){return '<a href="'+href+'" target="_self"'+(active?' class="is-active"':'')+'><span class="billsos-preview-icon">'+icon+'</span><span>'+label+'</span></a>'}

  function installSidebar(){
    if(document.getElementById('billsosPreviewSidebar'))return;
    var path=location.pathname,control=path.indexOf('/control')===0,legacy=path.indexOf('/legacy')===0,dashboard=!control&&!legacy;
    var aside=document.createElement('aside');aside.id='billsosPreviewSidebar';aside.className='billsos-preview-sidebar';aside.setAttribute('aria-label','BillsOS navigation');
    aside.innerHTML='<div class="billsos-preview-brand"><div class="billsos-preview-mark">B</div><div><strong>BillsOS</strong><small>Cash flow planner</small></div></div><nav class="billsos-preview-nav">'+item('⌂','Dashboard','/',dashboard)+item('▦','Calendar','/#calendar',false)+item('◎','Control Center','/control',control)+item('◫','Legacy','/legacy',legacy)+'<button type="button" id="billsosPreviewAsk"><span class="billsos-preview-icon">✦</span><span>Ask BillsOS</span></button><div class="billsos-preview-divider"></div><button type="button" id="billsosPreviewWeeks" hidden><span class="billsos-preview-icon">−</span><span>Collapse weeks</span></button></nav><div class="billsos-preview-footer">● BillsOS online</div>';
    document.body.appendChild(aside);
    var menu=document.createElement('button');menu.id='billsosPreviewMenu';menu.type='button';menu.setAttribute('aria-label','Open navigation');menu.textContent='☰';document.body.appendChild(menu);
    var scrim=document.createElement('div');scrim.id='billsosPreviewScrim';document.body.appendChild(scrim);
    menu.onclick=function(){document.body.classList.toggle('billsos-preview-open')};scrim.onclick=function(){document.body.classList.remove('billsos-preview-open')};
    aside.addEventListener('click',function(event){
      var link=event.target.closest&&event.target.closest('a[href]');
      if(link){event.preventDefault();var href=link.getAttribute('href');if(href==='/#calendar'&&dashboard){var panel=document.querySelector('.month-panel.show')||document.querySelector('.month-panel');if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});else location.assign('/')}else location.assign(href);document.body.classList.remove('billsos-preview-open');}
    });
    var ask=document.getElementById('billsosPreviewAsk');if(ask)ask.onclick=function(){var controls=Array.prototype.slice.call(document.querySelectorAll('button,a'));var target=controls.find(function(el){return !el.closest('#billsosPreviewSidebar')&&/ask billsos/i.test(String(el.textContent||''))});if(target)target.click();else location.assign('/');document.body.classList.remove('billsos-preview-open')};
  }

  function install(){
    addFont();addStyles();document.body.classList.add('billsos-preview');installSidebar();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>`;

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const result = originalReadFileSync.apply(this, arguments);
  const name = String(filePath || '');
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  const isText = !encoding || encoding === 'utf8' || encoding === 'utf-8';
  const isDashboard = name.endsWith('generated-v5.html');
  const isControl = name.endsWith('control.html');
  const isLegacy = name.endsWith('index.html');
  if (!isText || (!isDashboard && !isControl && !isLegacy)) return result;

  let html = Buffer.isBuffer(result) ? result.toString('utf8') : String(result);
  if (isDashboard) {
    html = upsertScript(html, '<script defer src="/amount-balance-hotfix.js?v=20260728calendartruth4"></script>');
    html = upsertScript(html, '<script defer src="/billsos-cross-device-sync.js?v=20260730localfirst1"></script>');
  }
  if (!html.includes('id="billsosSafePreview"')) html = html.replace('</body>', safePreview + '\n</body>');
  return Buffer.isBuffer(result) ? Buffer.from(html, 'utf8') : html;
};
