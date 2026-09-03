(function(){
  'use strict';
  var BUILD='assistant-ai-bridge-20260820-format1';
  var THEME_KEY='billsos-theme-v1';
  window.BillsOSModules=window.BillsOSModules||{};
  var state={loaded:true,build:BUILD,at:new Date().toISOString(),observing:false,requests:0,successes:0,failures:0,lastStatus:'initializing',lastError:null,model:null};
  window.BillsOSModules.assistantAiBridge=state;
  function cleanText(node){return String(node&&node.textContent||'').replace(/\s+/g,' ').trim()}
  function esc(v){return String(v||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}
  function userQuestionFor(node){var cur=node&&node.previousElementSibling;while(cur){if(cur.classList&&cur.classList.contains('billsos-msg')&&cur.classList.contains('user'))return cleanText(cur);cur=cur.previousElementSibling}return ''}
  function source(node,text,kind){var p=node.querySelector('.billsos-ai-source');if(!p){p=document.createElement('p');p.className='billsos-ai-source';p.style.cssText='margin-top:8px;color:#64748b;font-size:11px';node.appendChild(p)}p.textContent=text;if(kind)p.dataset.kind=kind}
  function answerHtml(text){
    var lines=String(text||'').split(/\n/).map(function(x){return x.trim()}).filter(Boolean);
    if(!lines.length)return '';
    var title='',total='',body=[],rows=[];
    lines.forEach(function(line){
      if(/^[-*•]\s+/.test(line)){rows.push(line.replace(/^[-*•]\s+/,''));return}
      if(!title){
        var combined=line.match(/^(.*?)\s+[—–-]\s+(Total\s*:\s*.+)$/i);
        if(combined){title=combined[1].trim();total=combined[2].trim();return}
        if(/^Total\b/i.test(line)){total=line;return}
        title=line;
        return;
      }
      if(!total&&/^Total\b/i.test(line)){total=line;return}
      body.push(line);
    });
    var html='<div class="billsos-ai-answer">';
    if(title)html+='<p class="billsos-ai-answer-title">'+esc(title)+'</p>';
    if(total)html+='<p class="billsos-ai-answer-total">'+esc(total)+'</p>';
    body.forEach(function(line){html+='<p class="billsos-ai-answer-copy">'+esc(line)+'</p>'});
    if(rows.length)html+='<ul class="billsos-ai-answer-list">'+rows.map(function(row){return '<li>'+esc(row)+'</li>'}).join('')+'</ul>';
    return html+'</div>';
  }
  async function rewrite(node,question,deterministic){state.requests++;state.lastStatus='requesting-openai';try{var res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:question,deterministicAnswer:deterministic})});var data=await res.json().catch(function(){return {}});if(!res.ok||!data||!data.answer)throw new Error(data&&data.error?data.error:'OpenAI assistant response failed');state.successes++;state.model=data.model||null;state.lastStatus='openai-response-applied';state.lastError=null;node.innerHTML=answerHtml(data.answer);source(node,'ChatGPT response · '+(data.model||'model unspecified')+' · BillsOS math','openai')}catch(e){state.failures++;state.lastStatus='local-response-kept';state.lastError=String(e&&e.message||e);source(node,'Local BillsOS answer · ChatGPT unavailable: '+state.lastError,'local')}}
  function mark(node){if(!node||!node.classList||node.classList.contains('user')||node.dataset.aiBridge==='1')return;if(node.dataset&&node.dataset.billsosIntro==='1')return;var text=cleanText(node);if(!text||/checking billsos/i.test(text)||/ask:\s*“?/i.test(text))return;var question=userQuestionFor(node);if(!question)return;node.dataset.aiBridge='1';var deterministic=node.innerHTML||text;source(node,'Sending to ChatGPT · model from OPENAI_MODEL · BillsOS math is source of truth','pending');rewrite(node,question,deterministic)}
  function scan(){document.querySelectorAll('#billsosAiLog .billsos-msg:not(.user)').forEach(mark)}
  function observe(){var log=document.getElementById('billsosAiLog');if(!log)return false;if(log.dataset.aiBridgeObserver==='1')return true;log.dataset.aiBridgeObserver='1';new MutationObserver(function(records){records.forEach(function(record){Array.prototype.forEach.call(record.addedNodes||[],function(node){if(node&&node.nodeType===1&&node.classList&&node.classList.contains('billsos-msg'))setTimeout(function(){mark(node)},80)})})}).observe(log,{childList:true,subtree:false});state.observing=true;state.lastStatus='observing-assistant-responses';scan();return true}

  function currentTheme(){try{return localStorage.getItem(THEME_KEY)||'light'}catch(e){return 'light'}}
  function applyBillsTheme(theme){var dark=theme==='dark';document.documentElement.setAttribute('data-billsos-theme',dark?'dark':'light');try{localStorage.setItem(THEME_KEY,dark?'dark':'light')}catch(e){}document.querySelectorAll('#billsosThemeToggleV2').forEach(function(btn){btn.setAttribute('aria-pressed',dark?'true':'false');btn.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');var icon=btn.querySelector('.bo-theme-icon'),label=btn.querySelector('.bo-theme-label');if(icon)icon.textContent=dark?'☀':'☾';if(label)label.textContent=dark?'Light mode':'Dark mode'})}
  function toggleBillsTheme(){applyBillsTheme(currentTheme()==='dark'?'light':'dark')}
  function installThemeCss(){if(document.getElementById('billsosDarkModeV2Css'))return;var s=document.createElement('style');s.id='billsosDarkModeV2Css';s.textContent='\
    #billsosThemeToggleV2{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 12px;padding:11px 12px;border:1px solid var(--bo-line,#dfe6de);border-radius:12px;background:rgba(255,255,255,.82);color:var(--bo-ink,#18231d);font:inherit;font-size:12px;font-weight:750;cursor:pointer;box-shadow:0 5px 18px rgba(31,59,44,.05);transition:transform .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}\
    #billsosThemeToggleV2:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(31,59,44,.10)}\
    #billsosThemeToggleV2 .bo-theme-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#e8f1e7;color:#2f7048;font-size:15px}\
    #billsosThemeToggleV2 .bo-theme-spacer{margin-left:auto;color:#91a097;font-size:15px}\
    html[data-billsos-theme="dark"]{--bo-bg:#08110d;--bo-card:#101b15;--bo-ink:#eef8f1;--bo-muted:#93a69a;--bo-line:#24362c;--bo-green:#77c68d;--bo-green2:#3f8f5a;--bo-soft:#173022;--bo-red:#ff8e82;--bo-shadow:0 14px 38px rgba(0,0,0,.34);--billsos-warm-bg:#08110d;--billsos-warm-bg-2:#101b15;--billsos-surface:rgba(16,27,21,.90);--billsos-surface-solid:#101b15;--billsos-ink:#eef8f1;--billsos-muted:#93a69a;--billsos-line:rgba(145,188,158,.16);--billsos-accent:#77c68d;--billsos-accent-2:#3f8f5a;--billsos-green:#8ee0a4;--billsos-red:#ff9a8f;--billsos-gold:#e4c777;color-scheme:dark}\
    html[data-billsos-theme="dark"] body,html[data-billsos-theme="dark"] body.bo-app{background:radial-gradient(circle at 14% -5%,rgba(63,143,90,.19),transparent 30%),radial-gradient(circle at 92% 2%,rgba(33,92,59,.16),transparent 27%),linear-gradient(145deg,#07100c 0%,#0b1510 46%,#101c16 100%)!important;color:#eef8f1!important}\
    html[data-billsos-theme="dark"] .bo-sidebar{background:linear-gradient(180deg,rgba(10,20,15,.98),rgba(7,15,11,.98))!important;border-color:#203229!important;box-shadow:12px 0 40px rgba(0,0,0,.16)}\
    html[data-billsos-theme="dark"] .bo-brand strong,html[data-billsos-theme="dark"] .bo-home-head h1,html[data-billsos-theme="dark"] .bo-panel h2,html[data-billsos-theme="dark"] .bo-detail-head h2,html[data-billsos-theme="dark"] .bo-kpi-value{color:#f1faf3!important}\
    html[data-billsos-theme="dark"] .bo-brand small,html[data-billsos-theme="dark"] .bo-home-head p,html[data-billsos-theme="dark"] .bo-detail-head p,html[data-billsos-theme="dark"] .bo-detail-meta,html[data-billsos-theme="dark"] .bo-empty,html[data-billsos-theme="dark"] .bo-copy{color:#8fa398!important}\
    html[data-billsos-theme="dark"] .bo-nav a{color:#b8c8be!important}\
    html[data-billsos-theme="dark"] .bo-nav a:hover{background:#13251b!important;color:#eef8f1!important}\
    html[data-billsos-theme="dark"] .bo-nav a.is-active{background:linear-gradient(135deg,#245f3a,#4b9863)!important;color:#fff!important;box-shadow:0 10px 24px rgba(20,90,49,.26)!important}\
    html[data-billsos-theme="dark"] .bo-status,html[data-billsos-theme="dark"] .bo-month,html[data-billsos-theme="dark"] .bo-kpi,html[data-billsos-theme="dark"] .bo-panel,html[data-billsos-theme="dark"] .bo-action,html[data-billsos-theme="dark"] .bo-upcoming-row,html[data-billsos-theme="dark"] .bo-detail-row,html[data-billsos-theme="dark"] .bo-detail-close{background:linear-gradient(180deg,#111d17,#0e1913)!important;border-color:#24362c!important;color:#eef8f1!important;box-shadow:0 12px 30px rgba(0,0,0,.20)!important}\
    html[data-billsos-theme="dark"] .bo-kpi.is-clickable:hover{border-color:#3f6f51!important;box-shadow:0 18px 36px rgba(0,0,0,.30)!important}\
    html[data-billsos-theme="dark"] .bo-kpi-label{color:#9daf9f!important}\
    html[data-billsos-theme="dark"] .bo-kpi-note,html[data-billsos-theme="dark"] .bo-upcoming-date,html[data-billsos-theme="dark"] .bo-detail-date{color:#82d398!important}\
    html[data-billsos-theme="dark"] .bo-kpi-icon{background:#173323!important;color:#8ee0a4!important}\
    html[data-billsos-theme="dark"] .bo-detail-scrim{background:rgba(1,7,4,.62)!important}\
    html[data-billsos-theme="dark"] .bo-detail-drawer{background:linear-gradient(180deg,#0d1812,#09120d)!important;border-color:#24362c!important;box-shadow:-24px 0 70px rgba(0,0,0,.48)!important}\
    html[data-billsos-theme="dark"] .hero,html[data-billsos-theme="dark"] .card,html[data-billsos-theme="dark"] .calPanel,html[data-billsos-theme="dark"] .month-panel,html[data-billsos-theme="dark"] .drawer,html[data-billsos-theme="dark"] .sheetCard{background:linear-gradient(180deg,rgba(17,29,23,.97),rgba(11,21,16,.96))!important;border-color:#24362c!important;color:#eef8f1!important;box-shadow:0 18px 48px rgba(0,0,0,.34)!important}\
    html[data-billsos-theme="dark"] .day,html[data-billsos-theme="dark"] .kpi,html[data-billsos-theme="dark"] .detailItem{background:#0f1a14!important;border-color:#24362c!important;color:#eef8f1!important;box-shadow:0 8px 22px rgba(0,0,0,.20)!important}\
    html[data-billsos-theme="dark"] .day:hover{border-color:#3c6e50!important;background:#122019!important}\
    html[data-billsos-theme="dark"] .ev{background:#17231c!important;color:#dce9df!important;border-color:#293b31!important}\
    html[data-billsos-theme="dark"] .ev.in{background:#12301e!important;color:#8ee0a4!important;border-color:#245b38!important}\
    html[data-billsos-theme="dark"] .ev.out{background:#381b19!important;color:#ff9a8f!important;border-color:#65322d!important}\
    html[data-billsos-theme="dark"] .ev.system,html[data-billsos-theme="dark"] .ev.sweep{background:#2c2816!important;color:#e4c777!important;border-color:#5a5024!important}\
    html[data-billsos-theme="dark"] input,html[data-billsos-theme="dark"] select,html[data-billsos-theme="dark"] textarea{background:#0b1510!important;color:#eef8f1!important;border-color:#2a4034!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}\
    html[data-billsos-theme="dark"] input::placeholder,html[data-billsos-theme="dark"] textarea::placeholder{color:#667a6e!important}\
    html[data-billsos-theme="dark"] input:focus,html[data-billsos-theme="dark"] select:focus,html[data-billsos-theme="dark"] textarea:focus{border-color:#5aa974!important;box-shadow:0 0 0 4px rgba(89,169,116,.13)!important}\
    html[data-billsos-theme="dark"] .tablewrap,html[data-billsos-theme="dark"] table{background:#0d1812!important;border-color:#24362c!important;color:#eef8f1!important}\
    html[data-billsos-theme="dark"] th{background:#132019!important;color:#91a499!important;border-color:#24362c!important}\
    html[data-billsos-theme="dark"] td{border-color:#1d3026!important}\
    html[data-billsos-theme="dark"] tr:hover td{background:#112019!important}\
    html[data-billsos-theme="dark"] .btn,html[data-billsos-theme="dark"] .linkbtn,html[data-billsos-theme="dark"] .tab{background:#121f18!important;color:#dce8df!important;border-color:#2b4035!important;box-shadow:0 6px 18px rgba(0,0,0,.18)!important}\
    html[data-billsos-theme="dark"] .btn.primary,html[data-billsos-theme="dark"] .tab.active{background:linear-gradient(135deg,#2f7048,#529565)!important;color:#fff!important;border-color:#5d9f6f!important}\
    html[data-billsos-theme="dark"] #billsosThemeToggleV2{background:linear-gradient(135deg,#101e17,#14261c)!important;color:#e9f4ec!important;border-color:#2a4134!important}\
    html[data-billsos-theme="dark"] #billsosThemeToggleV2 .bo-theme-icon{background:#1e3d29!important;color:#9be4ad!important}\
    html[data-billsos-theme="dark"] .ar-suggestion,html[data-billsos-theme="dark"] .ar-stat,html[data-billsos-theme="dark"] .ar-entry,html[data-billsos-theme="dark"] .ar-audit-row{background:#0f1b15!important;border-color:#294034!important;color:#eef8f1!important}\
    html[data-billsos-theme="dark"] .ar-warning{background:#2a2414!important;color:#e7cd83!important}\
    html[data-billsos-theme="dark"] .ar-badge{background:#183321!important;color:#8ee0a4!important}\
    html[data-billsos-theme="dark"]{--bo-bg:#111418;--bo-card:#1b2025;--bo-ink:#f2f4f3;--bo-muted:#9ba5a0;--bo-line:#30383d;--bo-green:#79b98d;--bo-green2:#4f8d65;--bo-soft:#25362c;--bo-red:#e18a80;--bo-shadow:0 12px 32px rgba(0,0,0,.22);--billsos-warm-bg:#111418;--billsos-warm-bg-2:#171b1f;--billsos-surface:#1b2025;--billsos-surface-solid:#1b2025;--billsos-ink:#f2f4f3;--billsos-muted:#9ba5a0;--billsos-line:#30383d;--billsos-accent:#79b98d;--billsos-accent-2:#4f8d65;--billsos-green:#8bc99e;--billsos-red:#e39187;--billsos-gold:#d2b86f}\
    html[data-billsos-theme="dark"] body,html[data-billsos-theme="dark"] body.bo-app{background:#111418!important;color:#f2f4f3!important}\
    html[data-billsos-theme="dark"] .bo-sidebar{background:#171b1f!important;border-color:#2a3136!important;box-shadow:none!important}\
    html[data-billsos-theme="dark"] .bo-nav a{color:#bdc5c1!important}\
    html[data-billsos-theme="dark"] .bo-nav a:hover{background:#20262a!important;color:#f2f4f3!important}\
    html[data-billsos-theme="dark"] .bo-nav a.is-active{background:#1a6f76!important;color:#fff!important;box-shadow:none!important}\
    html[data-billsos-theme="dark"] .bo-status,html[data-billsos-theme="dark"] .bo-month,html[data-billsos-theme="dark"] .bo-kpi,html[data-billsos-theme="dark"] .bo-panel,html[data-billsos-theme="dark"] .bo-action,html[data-billsos-theme="dark"] .bo-upcoming-row,html[data-billsos-theme="dark"] .bo-detail-row,html[data-billsos-theme="dark"] .bo-detail-close,html[data-billsos-theme="dark"] .hero,html[data-billsos-theme="dark"] .card,html[data-billsos-theme="dark"] .calPanel,html[data-billsos-theme="dark"] .month-panel,html[data-billsos-theme="dark"] .drawer,html[data-billsos-theme="dark"] .sheetCard{background:#1b2025!important;border-color:#30383d!important;color:#f2f4f3!important;box-shadow:0 10px 28px rgba(0,0,0,.18)!important}\
    html[data-billsos-theme="dark"] .bo-kpi.is-clickable:hover{background:#20262b!important;border-color:#465148!important;box-shadow:0 12px 30px rgba(0,0,0,.22)!important}\
    html[data-billsos-theme="dark"] .bo-detail-drawer{background:#171b1f!important;border-color:#30383d!important;box-shadow:-18px 0 44px rgba(0,0,0,.32)!important}\
    html[data-billsos-theme="dark"] .day,html[data-billsos-theme="dark"] .kpi,html[data-billsos-theme="dark"] .detailItem{background:#20252a!important;border-color:#343c41!important;color:#f2f4f3!important;box-shadow:none!important}\
    html[data-billsos-theme="dark"] .day:hover{background:#242a2f!important;border-color:#4c5b51!important}\
    html[data-billsos-theme="dark"] .ev{background:#292f34!important;color:#e4e8e6!important;border-color:#3a4348!important}\
    html[data-billsos-theme="dark"] .ev.in{background:#20392a!important;color:#9bd0aa!important;border-color:#315c40!important}\
    html[data-billsos-theme="dark"] .ev.out{background:#3a2827!important;color:#e8aaa3!important;border-color:#60413e!important}\
    html[data-billsos-theme="dark"] .ev.xfer,html[data-billsos-theme="dark"] .ev.system,html[data-billsos-theme="dark"] .ev.sweep{background:#383324!important;color:#dbc884!important;border-color:#5b5132!important}\
    html[data-billsos-theme="dark"] input,html[data-billsos-theme="dark"] select,html[data-billsos-theme="dark"] textarea{background:#15191d!important;color:#f2f4f3!important;border-color:#3a4449!important;box-shadow:none!important}\
    html[data-billsos-theme="dark"] .tablewrap,html[data-billsos-theme="dark"] table{background:#1b2025!important;border-color:#30383d!important;color:#f2f4f3!important}\
    html[data-billsos-theme="dark"] th{background:#20262a!important;color:#aeb8b3!important;border-color:#30383d!important}\
    html[data-billsos-theme="dark"] td{border-color:#2c3438!important}\
    html[data-billsos-theme="dark"] tr:hover td{background:#22282d!important}\
    html[data-billsos-theme="dark"] .btn,html[data-billsos-theme="dark"] .linkbtn,html[data-billsos-theme="dark"] .tab,html[data-billsos-theme="dark"] #billsosThemeToggleV2{background:#22282d!important;color:#e7ebe9!important;border-color:#384146!important;box-shadow:none!important}\
    html[data-billsos-theme="dark"] .btn.primary,html[data-billsos-theme="dark"] .tab.active{background:#1a6f76!important;color:#fff!important;border-color:#2d8d8f!important}\
    html[data-billsos-theme="dark"] #billsosThemeToggleV2 .bo-theme-icon{background:#1a3a3d!important;color:#5ec4c8!important}\
    html[data-billsos-theme="dark"] .bb-sheet{background:#1b2025!important;color:#f2f4f3!important;border:1px solid #30383d!important}\
    html[data-billsos-theme="dark"] .bb-stat,html[data-billsos-theme="dark"] .bb-preview{background:#22282d!important;border-color:#343d42!important;color:#dfe5e2!important}\
    html[data-billsos-theme="dark"] .bb-actions button{background:#242a2f!important;color:#edf1ef!important;border-color:#3a4449!important}\
    html[data-billsos-theme="dark"] .bb-actions .primary{background:#39724f!important;color:#fff!important;border-color:#4d8861!important}\
    html[data-billsos-theme="dark"] body.bo-app .month-panel,html[data-billsos-theme="dark"] body.bo-app .hero,html[data-billsos-theme="dark"] body.bo-app .card,html[data-billsos-theme="dark"] body.bo-app .calPanel,html[data-billsos-theme="dark"] body.bo-app .drawer{background:#1b2025!important;background-image:none!important;border-color:#30383d!important;color:#f2f4f3!important}\
    html[data-billsos-theme="dark"] body.bo-app .day{background:#20252a!important;background-image:none!important;border-color:#343c41!important;color:#f2f4f3!important;box-shadow:none!important}\
    @media(max-width:760px){#billsosThemeToggleV2{margin-top:8px}}';document.head.appendChild(s)}
  function mountThemeToggle(){var host=document.querySelector('.bo-side-bottom')||document.querySelector('.bo-sidebar')||document.querySelector('.nav');if(!host)return false;var btn=document.getElementById('billsosThemeToggleV2');if(!btn){btn=document.createElement('button');btn.id='billsosThemeToggleV2';btn.type='button';btn.innerHTML='<span class="bo-theme-icon">☾</span><span class="bo-theme-label">Dark mode</span><span class="bo-theme-spacer">›</span>';btn.onclick=toggleBillsTheme}if(host.classList&&host.classList.contains('bo-side-bottom')){if(btn.parentNode!==host)host.insertBefore(btn,host.firstChild)}else if(!btn.parentNode)host.appendChild(btn);applyBillsTheme(currentTheme());return true}
  function initTheme(){installThemeCss();applyBillsTheme(currentTheme());mountThemeToggle();setTimeout(mountThemeToggle,250);setTimeout(mountThemeToggle,900);setTimeout(mountThemeToggle,1800)}

  function loadAssistantReview(){if(location.pathname.indexOf('/control')!==0||document.getElementById('billsosAssistantReviewScript'))return;var s=document.createElement('script');s.id='billsosAssistantReviewScript';s.src='/assistant-review.js?v=20260806mvp1';s.defer=true;document.head.appendChild(s)}
  function init(){initTheme();loadAssistantReview();if(observe())return;setTimeout(observe,500);setTimeout(observe,1500);setTimeout(observe,3000)}
  window.addEventListener('storage',function(e){if(e.key===THEME_KEY)applyBillsTheme(e.newValue||'light')});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
