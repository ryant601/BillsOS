const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const registerAssistantApi = require("./assistant-api");
const { calendarRevision, writeReadonlySnapshot } = require("./readonly-calendar-preload");
const {
  applyCalendarStatePatch,
  prepareFullWrite,
  sameSourceVersion
} = require("./bills-data-integrity");

const app = express();

const USER = process.env.BILLS_USER || "ryan";
const PASS = process.env.BILLS_PASS || "";
const TEMP_USER = process.env.BILLS_TEMP_USER || "temp";
const TEMP_PASS = process.env.BILLS_TEMP_PASS || "";
const SECRET = process.env.SESSION_SECRET || PASS || TEMP_PASS || "change-me";
const DATA_DIR = process.env.BILLS_DATA_DIR || path.join(__dirname, "data");
const CHECKMARK_FILE = path.join(DATA_DIR, "checkmarks.json");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "2mb" }));

function makeToken(username = USER, password = PASS) {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${username}:${password}`)
    .digest("hex");
}

function validAccounts() {
  const accounts = [];
  if (PASS) accounts.push({ username: USER, password: PASS });
  if (TEMP_PASS) accounts.push({ username: TEMP_USER, password: TEMP_PASS });
  return accounts;
}

function authenticate(username, password) {
  return validAccounts().find(account => account.username === username && account.password === password);
}

function getCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map(cookie => {
        const [key, ...value] = cookie.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

function isLoggedIn(req) {
  const cookies = getCookies(req);
  return validAccounts().some(account => cookies.billsos_auth === makeToken(account.username, account.password));
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function writeJsonFile(filePath, payload) {
  ensureDataDir();
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
  fs.renameSync(tmp, filePath);
  return payload;
}

function readCheckmarks() {
  const parsed = readJsonFile(CHECKMARK_FILE, { completed: {}, updatedAt: null });
  return {
    completed: parsed && typeof parsed.completed === "object" && !Array.isArray(parsed.completed) ? parsed.completed : {},
    updatedAt: parsed.updatedAt || null
  };
}

function writeCheckmarks(completed) {
  const clean = {};
  Object.keys(completed || {}).forEach(key => {
    if (completed[key]) clean[key] = 1;
  });
  return writeJsonFile(CHECKMARK_FILE, { completed: clean, updatedAt: new Date().toISOString() });
}

function normalizeBillsData(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    bills: Array.isArray(src.bills) ? src.bills : [],
    oneTimeEvents: Array.isArray(src.oneTimeEvents) ? src.oneTimeEvents : [],
    income: Array.isArray(src.income) ? src.income : [],
    paymentSplits: Array.isArray(src.paymentSplits) ? src.paymentSplits : [],
    revision: calendarRevision(src),
    updatedAt: src.updatedAt || null
  };
}

function readBillsData() {
  return normalizeBillsData(readJsonFile(BILLS_FILE, { bills: [], oneTimeEvents: [], income: [], updatedAt: null }));
}

function writeBillsData(data) {
  const clean = normalizeBillsData(data);
  clean.updatedAt = new Date().toISOString();
  archiveBillsData();
  return writeJsonFile(BILLS_FILE, clean);
}

function archiveBillsData() {
  try {
    if (!fs.existsSync(BILLS_FILE)) return;
    const historyDir = path.join(DATA_DIR, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(BILLS_FILE, path.join(historyDir, `bills-${stamp}.json`));
    const history = fs.readdirSync(historyDir)
      .filter(name => /^bills-.*\.json$/.test(name))
      .sort();
    history.slice(0, Math.max(0, history.length - 200)).forEach(name => {
      fs.unlinkSync(path.join(historyDir, name));
    });
  } catch (_err) {
    // A failed safety copy must not make the primary atomic save fail.
  }
}

function generatedDashboardHtml() {
  const generatedPath = path.join(__dirname, "generated-v5.html");
  let html = fs.readFileSync(generatedPath, "utf8");

  html = html.replace(
    "</style></head>",
    ".moveBtn{position:absolute;right:5px;bottom:5px;display:inline-grid;place-items:center;width:12px;height:12px;padding:0;border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.68);border-radius:999px;font-size:8px;line-height:1;font-weight:900;color:inherit;opacity:.35;vertical-align:middle}.moveBtn:hover{opacity:1;background:rgba(255,255,255,.95)}.ev{position:relative;display:flex;align-items:flex-start;gap:6px;padding:6px 18px 22px 7px;min-height:48px;font-size:11px;line-height:1.06}.ev span{min-width:0;flex:1 1 auto;word-break:break-word;overflow-wrap:anywhere}.day{min-height:180px}.tag{display:block;font-size:9px;color:var(--mut);font-weight:800;margin-top:1px;line-height:1.05}.month-shell{display:grid;grid-template-columns:minmax(0,1fr) 12px var(--drawer-w,260px);gap:14px;align-items:start;margin-top:14px}.resizeHandle{display:flex;align-self:stretch;justify-content:center;cursor:col-resize;user-select:none;touch-action:none;min-height:100%}.resizeHandle::before{content:'';width:2px;border-radius:999px;background:rgba(31,58,61,.14);transition:background .15s ease,opacity .15s ease}.resizeHandle:hover::before,.resizeHandle.dragging::before{background:rgba(31,58,61,.42)}.grid{display:flex;gap:14px;align-items:flex-start;margin:12px 0}.grid>.card:first-child{flex:1 1 0;min-width:0}.grid>.card:last-child{flex:0 0 34%;min-width:320px}.hero{display:flex;justify-content:space-between;gap:14px;padding:18px}.card{padding:14px}.card h2,.calPanel h2{margin:0 0 8px;font-size:22px;letter-spacing:-.03em}.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.kpi{background:#fbf7ef;border:1px solid rgba(222,214,202,.86);border-radius:16px;padding:10px 11px}.kpi span{display:block;font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.09em;font-weight:900}.kpi b{display:block;margin-top:4px;font-size:18px;line-height:1}.next{display:grid;gap:6px}.next div{display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(20,35,55,.08);padding-top:8px}.next div:first-child{border-top:0;padding-top:0}.tabs{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 12px}.drawer{position:sticky;top:12px;background:rgba(255,253,248,.98);border:1px solid rgba(31,58,61,.18);border-radius:22px;padding:16px;box-shadow:0 18px 42px rgba(55,43,31,.12)}.drawer .eyebrow{font-size:10px;letter-spacing:.2em;color:var(--primary);margin-bottom:8px}.drawer h3{margin:0 0 4px;font-size:20px;letter-spacing:-.03em}.drawer .sub{margin:0 0 12px;font-size:12px;color:var(--mut)}.detailList{display:grid;gap:8px}.detailItem{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;gap:8px;align-items:start;padding:10px 11px;border:1px solid rgba(222,214,202,.86);border-radius:14px;background:#fbf7ef}.detailItem .detailMain{min-width:0}.detailItem .dir{font-size:12px;font-weight:900;line-height:1;min-width:14px;text-align:center;padding-top:1px}.detailItem .dir.in{color:var(--green)}.detailItem .dir.out{color:var(--outflow)}.detailItem .name{font-size:12px;font-weight:700;line-height:1.3}.detailItem .amt{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;white-space:nowrap;justify-self:end}.detailItem input{width:14px;height:14px;margin-top:2px}.detailEmpty{border:1px dashed rgba(222,214,202,.92);border-radius:14px;padding:14px;color:var(--mut);font-size:13px;line-height:1.5;background:#fff}.sheet{position:fixed;inset:0;background:rgba(20,24,28,.38);display:none;align-items:flex-end;justify-content:center;padding:16px;z-index:20}.sheet.on{display:flex}.sheetCard{width:min(460px,100%);background:var(--card);border:1px solid var(--line);border-radius:22px;padding:16px;box-shadow:0 22px 70px rgba(0,0,0,.22)}.sheetCard h3{margin:0 0 4px;font-size:22px}.sheetCard p{margin:0 0 12px;color:var(--mut)}.sheetGrid{display:grid;gap:8px}.sheetGrid button,.sheetGrid input{width:100%;border:1px solid var(--line);background:#fff;border-radius:14px;padding:12px;text-align:left;font-weight:900;color:var(--ink);font:inherit}.sheetGrid button.primary{background:var(--primary);color:#fff}.sheetGrid button.warn{color:var(--outflow)}.sheetGrid button.undo{background:#fbf7ef}@media(max-width:900px){.grid{display:grid;grid-template-columns:1fr}.grid>.card:first-child,.grid>.card:last-child{flex:none;min-width:0}.month-shell{grid-template-columns:1fr}.resizeHandle{display:none}.drawer{position:static}}</style></head>"
  );

  html = html.replaceAll(
    "grid-template-columns:repeat(5,minmax(0,1fr))",
    "grid-template-columns:repeat(6,minmax(0,1fr))"
  );
  html = html.replace(
    '<div class="kpi"><span>Ending</span><b id="kend">—</b></div><div class="kpi"><span>Open</span><b id="kopen">—</b></div>',
    '<div class="kpi"><span>Ending</span><b id="kend">—</b></div><div class="kpi"><span>Projected sweep</span><b id="ksweep">—</b></div><div class="kpi"><span>Open</span><b id="kopen">—</b></div>'
  );

  html = html.replace(
    "<div id=\"mount\"><div class=\"card\">Loading generated data...</div></div></div>",
    "<div class=\"month-shell\"><div id=\"mount\"><div class=\"card\">Loading generated data...</div></div><div class=\"resizeHandle\" id=\"resizeHandle\" aria-label=\"Resize calendar\" title=\"Drag to resize\"></div><aside class=\"drawer\" id=\"detailDrawer\"><div class=\"eyebrow\">Day details</div><h3 id=\"detailTitle\">Select a day</h3><p class=\"sub\" id=\"detailSub\">Click any day to see its bills and balances.</p><div id=\"detailContent\" class=\"detailEmpty\">The right-hand panel will show a clearer summary for the selected day.</div></aside></div></div>"
  );

  html = html.replace(
    "function esc(s){return String(s||'').replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}function saveAttention(){localStorage.setItem('billsos-attention-collapsed-v1',attentionCollapsed?'1':'0')}function rowKey(e){return (e.originalDate||e.date)+'|'+e.name+'|'+e.amount}function itemKey(e){return e.originalKey||rowKey(e)}function todayIso(offset){var d=new Date();d.setDate(d.getDate()+(offset||0));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}function saveAdjust(){localStorage.setItem('billsos-pay-adjust-v1',JSON.stringify(adjust))}function saveDone(){localStorage.setItem('billsos-generated-done-v5',JSON.stringify(done))}function rememberUndo(k){lastUndo={key:k,adjust:adjust[k]?Object.assign({},adjust[k]):null,done:!!done[k]}}function undoLast(){if(!lastUndo)return;if(lastUndo.adjust)adjust[lastUndo.key]=lastUndo.adjust;else delete adjust[lastUndo.key];if(lastUndo.done)done[lastUndo.key]=1;else delete done[lastUndo.key];saveAdjust();saveDone();closeSheet();render(lastData);lastUndo=null}function loadDrawerWidth(){var saved=Number(localStorage.getItem('billsos-drawer-width-v1')||260);return isFinite(saved)?Math.max(220,Math.min(560,saved)):260}function applyDrawerWidth(n){var v=Math.max(220,Math.min(560,Number(n)||260));document.documentElement.style.setProperty('--drawer-w',v+'px');localStorage.setItem('billsos-drawer-width-v1',String(v));return v}function initResize(){var handle=document.getElementById('resizeHandle');if(!handle||handle.dataset.bound)return;handle.dataset.bound='1';var startX=0,startW=0;var onMove=function(ev){if(!resizeState)return;var dx=ev.clientX-startX;applyDrawerWidth(startW-dx)};var onUp=function(){if(!resizeState)return;resizeState=false;handle.classList.remove('dragging');window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp)};handle.addEventListener('pointerdown',function(ev){if(window.innerWidth<=900)return;resizeState=true;handle.classList.add('dragging');startX=ev.clientX;startW=Number(getComputedStyle(document.documentElement).getPropertyValue('--drawer-w'))||260;handle.setPointerCapture&&handle.setPointerCapture(ev.pointerId);window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp)})}applyDrawerWidth(loadDrawerWidth())"
  );

  html = html.replace(
    "function render(data){var model=chain(data),",
    "function render(data){lastData=data;var model=chain(data),"
  );

  html = html.replace(
    "currentRows=rows;rows.forEach(function(r){(by[r.day]||(by[r.day]=[])).push(r)});var openRows=rows.filter(function(x){return x.amount<0&&!done[id(x)]});",
    "currentRows=rows;eventMap={};rows.forEach(function(r){eventMap[itemKey(r)]=r;(by[r.day]||(by[r.day]=[])).push(r)});var openRows=rows.filter(function(x){return x.amount<0&&!done[itemKey(x)]});"
  );

  html = html.replace(
    "var openRows=rows.filter(function(x){return x.amount<0&&!done[itemKey(x)]});",
    "var openRows=rows.filter(function(x){return x.amount<0&&!done[itemKey(x)]}),projectedSweep=rows.filter(function(x){return x.amount<0&&/sweep/i.test(x.name)}).reduce(function(s,x){return s+Math.abs(x.amount)},0);"
  );
  html = html.replace(
    "kend.textContent=money(cur.end);kopen.textContent=openRows.length;",
    "kend.textContent=money(cur.end);ksweep.textContent=money(projectedSweep);kopen.textContent=openRows.length;"
  );

  html = html.replace(
    "var eid=id(e),ck=done[eid]?' checked':'';return '<label class=\"ev '+e.cls+(done[eid]?' done':'')+'\"><input type=\"checkbox\" data-id=\"'+esc(eid)+'\"'+ck+'><span>'+esc(e.name)+'</span><b>'+money(Math.abs(e.amount))+'</b></label>'",
    "var eid=itemKey(e),ck=done[eid]?' checked':'',tag=e.adjusted?'<small class=\"tag\">'+(done[eid]?'Paid':'Moved')+' from '+e.originalDate.slice(5)+'</small>':'';return '<label class=\"ev '+e.cls+(done[eid]?' done':'')+'\"><input type=\"checkbox\" data-id=\"'+esc(eid)+'\"'+ck+'><span>'+esc(e.name)+tag+'</span>'+(e.amount<0?'<button class=\"moveBtn\" type=\"button\" data-key=\"'+esc(eid)+'\">⋯</button>':'')+'</label>'"
  );

  html = html.replace(
    "localStorage.setItem('billsos-generated-done-v5',JSON.stringify(done));render(data)}})}",
    "saveDone();render(data)}});document.querySelectorAll('.moveBtn').forEach(function(btn){btn.onclick=function(ev){ev.preventDefault();ev.stopPropagation();openSheet(this.dataset.key)}});initResize();var detailDrawer=document.getElementById('detailDrawer'),detailTitle=document.getElementById('detailTitle'),detailSub=document.getElementById('detailSub'),detailContent=document.getElementById('detailContent');function openDay(day,ev){if(!day||day.classList.contains('blank'))return;if(ev&&ev.target&&ev.target.closest('input,button'))return;var numberEl=day.querySelector('.topline b'),dayNum=Number(numberEl&&numberEl.textContent);if(!dayNum||!detailTitle||!detailSub||!detailContent)return;selectedDayKey=val+'-'+String(dayNum).padStart(2,'0');var startEl=day.querySelector('.topline span:last-child b'),endEl=day.querySelector('.endline b');detailTitle.textContent=def[2]+' · Day '+String(dayNum).padStart(2,'0');detailSub.textContent='Starting '+(startEl?startEl.textContent:'—')+' · Ending '+(endEl?endEl.textContent:'—');detailContent.className='detailList';detailContent.innerHTML=(by[dayNum]||[]).map(function(e){var eid=itemKey(e),dir=e.amount>0?'+':'−',dirCls=e.amount>0?'in':'out';return \"<div class=\\\"detailItem\\\" data-detail-id=\\\"\"+esc(eid)+\"\\\"><div class=\\\"dir \"+dirCls+\"\\\">\"+dir+\"</div><div class=\\\"detailMain\\\"><div class=\\\"name\\\">\"+esc(e.name)+\"</div></div><div class=\\\"amt\\\">\"+money(Math.abs(e.amount))+\"</div></div>\"}).join(\"\")||\"<div class=\\\"detailEmpty\\\">No items on this day.</div>\";document.querySelectorAll('.day.selected').forEach(function(x){x.classList.remove('selected')});day.classList.add('selected')}var dayEls=Array.prototype.slice.call(document.querySelectorAll('.day:not(.blank)'));dayEls.forEach(function(day){day.onclick=function(ev){openDay(day,ev)}});var today=todayIso(),defaultDayKey=selectedDayKey&&selectedDayKey.slice(0,7)===val?selectedDayKey:(today.slice(0,7)===val?today:null);if(defaultDayKey){var defaultDayNum=Number(defaultDayKey.slice(8)),defaultDay=dayEls.find(function(day){var n=day.querySelector('.topline b');return Number(n&&n.textContent)===defaultDayNum});openDay(defaultDay,null)}else{detailTitle.textContent='Select a day';detailSub.textContent='Click any day to see its bills and balances.';detailContent.className='detailEmpty';detailContent.textContent='The right-hand panel will show a clearer summary for the selected day.'}}"
  );

  html = html.replace(
    "initResize();var detailDrawer=",
    "initResize();var monthKey=Y+'-'+String(m).padStart(2,'0');var detailDrawer="
  );
  html = html.replace("selectedDayKey=val+'-'", "selectedDayKey=monthKey+'-'");
  html = html.replace("selectedDayKey.slice(0,7)===val", "selectedDayKey.slice(0,7)===monthKey");
  html = html.replace("today.slice(0,7)===val", "today.slice(0,7)===monthKey");

  html = html.replace(
    "function tabs(){",
    "function monthNum(){var found=M.find(function(x){return x[0]===active});return found?found[1]:7}function setAdjustedDate(k,date,paid){var e=eventMap[k],month=Y+'-'+String(monthNum()).padStart(2,'0');if(!e||!date)return;if(String(date).slice(0,7)!==month){if(sheetMeta)sheetMeta.textContent='Choose a date in the visible month.';return}rememberUndo(k);adjust[k]={date:date,originalDate:e.originalDate||e.date,status:paid?'paid':'moved',updatedAt:new Date().toISOString()};if(paid)done[k]=1;saveAdjust();saveDone();closeSheet();render(lastData)}function openSheet(k){selectedKey=k;var e=eventMap[k];if(!e)return;if(sheetTitle)sheetTitle.textContent=e.name;if(sheetMeta)sheetMeta.textContent=money(Math.abs(e.amount))+' · Due '+(e.originalDate||e.date).slice(5)+(e.adjusted?' · Now '+e.date.slice(5):'');if(moveDate)moveDate.value=e.date;if(paySheet)paySheet.classList.add('on')}function closeSheet(){if(paySheet)paySheet.classList.remove('on');selectedKey=null}var paidToday=document.getElementById('paidToday'),paidYesterday=document.getElementById('paidYesterday'),moveChosen=document.getElementById('moveChosen'),clearMove=document.getElementById('clearMove'),undoMove=document.getElementById('undoMove'),closeSheetBtn=document.getElementById('closeSheet'),paySheet=document.getElementById('paySheet'),sheetTitle=document.getElementById('sheetTitle'),sheetMeta=document.getElementById('sheetMeta'),moveDate=document.getElementById('moveDate');if(paidToday)paidToday.onclick=function(){setAdjustedDate(selectedKey,todayIso(0),true)};if(paidYesterday)paidYesterday.onclick=function(){setAdjustedDate(selectedKey,todayIso(-1),true)};if(moveChosen)moveChosen.onclick=function(){setAdjustedDate(selectedKey,moveDate&&moveDate.value,false)};if(clearMove)clearMove.onclick=function(){if(selectedKey){rememberUndo(selectedKey);adjust[selectedKey]={deleted:true,updatedAt:new Date().toISOString()};delete done[selectedKey];saveAdjust();saveDone();closeSheet();render(lastData)}};if(undoMove)undoMove.onclick=undoLast;if(closeSheetBtn)closeSheetBtn.onclick=closeSheet;if(paySheet)paySheet.onclick=function(e){if(e.target===paySheet)closeSheet()};function tabs(){"
  );

  html = html.replace(
    "done=JSON.parse(localStorage.getItem('billsos-generated-done-v5')||'{}')||{};var r=await fetch",
    "done=JSON.parse(localStorage.getItem('billsos-generated-done-v5')||'{}')||{};adjust=JSON.parse(localStorage.getItem('billsos-pay-adjust-v1')||'{}')||{};var r=await fetch"
  );

  if (!html.includes('/day-details-enhance.js')) {
    html = html.replace('</body>', '<script defer src="/day-details-enhance.js?v=20260826q12027a"></script></body>');
  }

  return html;
}

function loginPage(error = "") {
  return `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BillsOS Login · LIVE BUILD 2026-07-01 v01565cb</title>
<style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: white; min-height: 100vh; display: grid; place-items: center; }
    .card { width: min(92vw, 380px); background: #111827; border: 1px solid #334155; border-radius: 18px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0 0 18px; color: #cbd5e1; }
    label { display: block; margin: 14px 0 6px; color: #cbd5e1; }
    input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px; border: 1px solid #475569; background: #020617; color: white; font-size: 16px; }
    button { width: 100%; margin-top: 18px; padding: 12px; border: 0; border-radius: 10px; background: #38bdf8; color: #082f49; font-weight: 700; font-size: 16px; }
    .error { margin-top: 12px; color: #fecaca; font-size: 14px; }
</style>
</head>
<body>
<form class="card" method="POST" action="/login">
<div style="margin:0 0 14px;padding:10px 12px;border-radius:14px;background:#a8651a;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 10px 20px rgba(0,0,0,.22)">LIVE BUILD · 2026-07-01 · v01565cb</div>
<h1>BillsOS</h1>
<p>Sign in to view the dashboard. Build stamp: LIVE BUILD · 2026-07-01 · v01565cb</p>
<label>Username</label>
<input name="username" autocomplete="username" required>
<label>Password</label>
<input name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button>
    ${error ? `<div class="error">${error}</div>` : ""}
</form>
</body>
</html>
`;
}

app.get("/login", (req, res) => {
  if (!validAccounts().length) return res.status(500).send("Set BILLS_PASS or BILLS_TEMP_PASS on Render.");
  res.send(loginPage());
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const account = authenticate(username, password);
  if (account) {
    res.setHeader("Set-Cookie", `billsos_auth=${makeToken(account.username, account.password)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
    return res.redirect("/");
  }
  res.status(401).send(loginPage("Invalid username or password."));
});

app.get("/logout", (req, res) => {
  res.setHeader("Set-Cookie", "billsos_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  res.redirect("/login");
});

app.use((req, res, next) => {
  if (req.path === "/login") return next();
  if (isLoggedIn(req)) return next();
  return res.redirect("/login");
});

app.get("/api/checkmarks", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readCheckmarks());
});

app.post("/api/checkmarks", (req, res) => {
  try {
    const completed = req.body && req.body.completed;
    if (!completed || typeof completed !== "object" || Array.isArray(completed)) {
      return res.status(400).json({ error: "Expected { completed: object }" });
    }
    res.json(writeCheckmarks(completed));
  } catch (_err) {
    res.status(500).json({ error: "Could not save checkmarks" });
  }
});

app.get("/api/bills", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readBillsData());
});

app.post("/api/bills", (req, res) => {
  try {
    const current = readBillsData();
    if (!sameSourceVersion(current, req.body)) {
      return res.status(409).json({
        error: "Bills data changed on another device",
        conflict: true,
        current
      });
    }
    const saved = writeBillsData(prepareFullWrite(current, req.body));
    const exported = writeReadonlySnapshot(saved);
    res.json({ ...saved, revision: exported.revision, readonlyGeneratedAt: exported.generatedAt });
  } catch (_err) {
    res.status(500).json({ error: "Could not save bills control data" });
  }
});

app.patch("/api/bills/calendar-state", (req, res) => {
  try {
    const current = readBillsData();
    const saved = writeBillsData(applyCalendarStatePatch(current, req.body));
    const exported = writeReadonlySnapshot(saved);
    res.json({ ...saved, revision: exported.revision, readonlyGeneratedAt: exported.generatedAt });
  } catch (_err) {
    res.status(500).json({ error: "Could not save calendar state" });
  }
});

registerAssistantApi(app, { readBillsData });

app.get("/generated", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.send(generatedDashboardHtml());
});

app.get("/legacy", (_req, res) => {
  try {
    const indexPath = path.join(__dirname, "index.html");
    let html = fs.readFileSync(indexPath, "utf8");
    const syncScript = '<script defer src="/cloud-sync.js?v=20260626cloud2"></script>';
    if (!html.includes("/cloud-sync.js")) html = html.replace("</body>", `${syncScript}\n</body>`);
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (_err) {
    res.sendFile(path.join(__dirname, "index.html"));
  }
});

app.get("/control", (_req, res) => {
  try {
    const controlPath = path.join(__dirname, "control.html");
    let html = fs.readFileSync(controlPath, "utf8");
    const themeLink = '<link rel="stylesheet" href="/control-theme.css?v=20260825controldark1">';
    const previewScript = '<script defer src="/control-preview.js?v=20260826transparent1"></script>';
    if (!html.includes("/control-theme.css")) html = html.replace("</head>", `${themeLink}\n</head>`);
    if (!html.includes("/control-preview.js")) html = html.replace("</body>", `${previewScript}\n</body>`);
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (_err) {
    res.sendFile(path.join(__dirname, "control.html"));
  }
});

app.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.send(generatedDashboardHtml());
});

app.get(["/generated.html", "/generated-v2.html", "/generated-v3.html", "/generated-v4.html", "/latest.html"], (_req, res) => {
  res.redirect(302, "/?view=calendar");
});

app.use(express.static(__dirname));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BillsOS running on port ${port}`);
});
