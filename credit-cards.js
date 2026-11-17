(function () {
'use strict';
const bonusView = new URLSearchParams(location.search).get('view') === 'bonus';
if (!bonusView && new URLSearchParams(location.search).get('view') !== 'credit-cards') return;
document.documentElement.classList.add('credit-cards-active');
const root = document.createElement('main'); root.id = 'creditCards'; document.body.append(root);
let store, snapshot, selected, preview, busy = false;
const owner = !window.BillsOSSession || window.BillsOSSession.role !== 'viewer';
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v == null ? 'Not entered' : Number(v).toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2});
function expanded(key, fallback) { try { const saved=localStorage.getItem(key);return saved==null?fallback:saved==='1'; } catch(_){return fallback;} }
const estimate = c => (store.estimates||[]).find(e=>e.cardId===c.id&&e.available);
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'America/New_York'});
async function api(path, body) { const r = await fetch('/api/credit-cards' + path, { method:body ? 'POST':'GET', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not save'); return data; }
const cards = () => store.cards.filter(c => !c.archived);
function notice(text, error) { const el = root.querySelector('#ccNotice'); el.textContent = text; el.className = 'cc-notice' + (error ? ' cc-error' : ''); }
function dueDateLabel(card) { const d=Number(card.dueDay);if(!d)return 'Not linked';const suffix=d%100>=11&&d%100<=13?'th':({1:'st',2:'nd',3:'rd'}[d%10]||'th');return d+suffix+(d>28?' (or month-end)':''); }
function table(list) { return '<div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Card</th><th>Due each month</th><th>Recorded balance</th><th>Estimated today</th><th>APR</th><th>Monthly payment</th><th>Utilization</th><th></th></tr></thead><tbody>' + list.map(c => '<tr><td><strong>'+esc(c.name)+'</strong><div class="cc-small">'+(c.balanceAsOf?'Updated '+esc(c.balanceAsOf):'Balance needed')+'</div></td><td>'+esc(dueDateLabel(c))+'</td><td>'+money(c.balance)+'</td><td>'+money(estimate(c)?.current)+'</td><td>'+(c.apr == null?'—':c.apr+'%')+'</td><td>'+money(c.payment)+'</td><td>'+(c.limit>0&&c.balance!=null?(100*c.balance/c.limit).toFixed(1)+'%':'—')+'</td><td><button data-edit="'+esc(c.id)+'">'+(owner?'Update':'View')+'</button>'+(owner?' <button data-remove="'+esc(c.id)+'">Remove</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'; }
function render() {
 if (bonusView) { renderBonusSandbox(); return; }
 const active=cards(), known=active.filter(c=>c.balance!=null), total=known.reduce((s,c)=>s+c.balance,0), initial=known.reduce((s,c)=>s+(c.history?.[0]?.balance??c.balance),0), interest=known.filter(c=>c.apr!=null).reduce((s,c)=>s+c.balance*c.apr/1200,0), missing=active.length-known.length;
 root.innerHTML='<header class="cc-top"><div><div class="cc-eyebrow">YOUR PATH TO DEBT FREE</div><h1>Credit Cards</h1><p>Know what you owe. Choose your next move.</p></div>'+(owner?'<button id="ccAdd" class="cc-primary">＋ Add card</button>':'')+'</header><div id="ccNotice" class="cc-notice" role="status">Recorded balances stay as entered. Estimates account for interest and payments marked paid, assuming no new spending.</div><section class="cc-stats">'+[['Recorded debt',known.length?money(total):'—'],['Reduction since first entries',known.length?money(initial-total):'—'],['Monthly payments',money(active.reduce((s,c)=>s+(c.payment||0),0))],['Estimated monthly interest',known.some(c=>c.apr!=null)?money(interest):'—']].map(x=>'<article class="cc-stat"><span>'+x[0]+'</span><strong>'+x[1]+'</strong></article>').join('')+'</section><p class="cc-small">'+known.length+' of '+active.length+' balances entered'+(missing?' · Totals are incomplete until all balances are entered.':'.')+' Fixed payment plans are tracked in Liabilities. Interest estimate covers cards with an APR entered.</p><details class="cc-panel cc-collapse" id="ccCardDetails" '+(expanded('billsos-card-details-open',false)?'open':'')+'><summary>Card details <span>Balances, APRs &amp; monthly updates</span></summary><p>Due dates come from the Bills control center and refresh when this page loads. Calendar moves can differ. Monthly payments here are budgets for payoff estimates; scheduled bills remain managed in Bills.</p>'+table(active.filter(c=>!c.paymentPlan))+(store.cards.some(c=>c.archived)?'<details class="cc-archive"><summary>Archived cards</summary>'+table(store.cards.filter(c=>c.archived))+'</details>':'')+'</details>'+'<details class="cc-panel cc-collapse cc-monthly" id="ccEstimateDetails" '+(expanded('billsos-card-estimates-open',false)?'open':'')+'><summary>Monthly balance estimates <span>No new spending assumed</span></summary><div id="ccEstimates"></div></details>'+debtPlannerHtml()+bonusPlannerHtml()+'<section class="cc-panel"><h2>Find room for an extra payment</h2><p>Check a payment against every daily ending balance from its date through December 2027, including payments already planned.</p><form id="ccPayment" class="cc-form"><label class="cc-wide">Card<select name="cardId">'+active.filter(c=>!c.paymentPlan&&c.balance>0).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><label>Extra payment<input name="amount" type="number" min=".01" step=".01" required placeholder="100.00"></label><label>Keep at least<input name="buffer" type="number" min="0" step=".01" value="950" required></label><label>Earliest date<input name="start" type="date" min="'+today()+'" max="2027-12-31" value="'+today()+'" required></label><label>Latest date<input name="end" type="date" min="'+today()+'" max="2027-12-31" value="'+new Date(Date.now()+30*864e5).toISOString().slice(0,10)+'" required></label><button type="submit" class="cc-primary cc-wide" '+(!owner?'disabled':'')+'>Find payment dates</button></form><div id="ccOptions" aria-live="polite"></div></section><section class="cc-panel"><h2>Additional payments on your calendar</h2><p>These are scheduled expenses, not confirmed payments. Edit or remove them on the calendar, and update balances after payments post.</p><div id="ccPlanned"></div></section>'+removedAccounts()+'<dialog id="ccDialog"><form id="ccEdit" class="cc-form"></form></dialog>';
 root.querySelector('#ccAdd')?.addEventListener('click',()=>edit(null));
 bindRemoval();
 root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(store.cards.find(c=>c.id===b.dataset.edit)));
 root.querySelectorAll('[data-debt-planner]').forEach(bindDebtPlanner);
 root.querySelector('#ccPayment').onsubmit=async e=>{ e.preventDefault(); if(busy)return; busy=true; const button=e.submitter;button.disabled=true;try { const input=Object.fromEntries(new FormData(e.target)); preview={input, result:await api('/preview',input)}; options(); } catch(err){notice(err.message,true);} finally{busy=false;button.disabled=false;} };
 root.querySelector('#ccPayment').oninput=()=>{preview=null;root.querySelector('#ccOptions').innerHTML='';};
 root.querySelectorAll('.cc-collapse').forEach(el=>el.addEventListener('toggle',()=>{try{localStorage.setItem(el.id==='ccCardDetails'?'billsos-card-details-open':'billsos-card-estimates-open',el.open?'1':'0');}catch(_){}}));
 monthlyEstimates(); planned();
}
function removedAccounts(){return (store.removed||[]).length?'<details class="cc-panel cc-monthly"><summary>Removed accounts ('+store.removed.length+')</summary><p>Removed from tracking only. Bills and calendar payments are unchanged.</p>'+store.removed.map(c=>'<p>'+esc(c.name)+(owner?' <button data-restore="'+esc(c.id)+'">Restore</button>':'')+'</p>').join('')+'</details>':'';}
function bindRemoval(){for(const action of ['remove','restore'])root.querySelectorAll('[data-'+action+']').forEach(b=>b.onclick=async()=>{if(busy)return;if(action==='remove'&&!confirm('Remove this card from tracking? Its bills and calendar payments will remain. You can restore it from Removed accounts.'))return;busy=true;b.disabled=true;try{store=await api('/'+action,{id:b.dataset[action],revision:store.revision});preview=null;render();notice(action==='remove'?'Card removed from tracking. Calendar payments are unchanged.':'Card restored.');}catch(err){notice(err.message,true);}finally{busy=false;b.disabled=false;}});}
function monthlyEstimates() {
 const box=root.querySelector('#ccEstimates');
 const available=cards().filter(c=>estimate(c));
 if(!available.length){box.innerHTML='<p>Enter a balance, its date, and APR (including 0% where applicable) to start automatic estimates. Open Card details above to update a card.</p>';return;}
 box.innerHTML='<p>Estimates start from your last recorded balance. Through today, only payments marked paid are subtracted, using their calendar dates. Future months include scheduled payments. A new recorded balance resets the calculation.</p><label>Choose a card<select id="ccEstimateCard">'+available.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><div id="ccEstimateTable"></div><p class="cc-small">Approximation: daily interest at APR ÷ 365 with daily compounding, no new spending or fees. Actual statement interest may differ. The balance date is treated as the end of that day, so payments on or before it are already included. Estimates never replace your recorded balances or mark payments paid.</p>';
 function show(){
  const c=available.find(c=>c.id===box.querySelector('#ccEstimateCard').value), e=estimate(c);
  box.querySelector('#ccEstimateTable').innerHTML='<div class="cc-estimate-summary"><div><span class="cc-small">Recorded '+esc(e.baselineDate)+'</span><h3>'+money(e.baseline)+'</h3></div><div><span class="cc-small">Estimated today · '+esc(e.asOf)+'</span><h3>'+money(e.current)+'</h3></div><button data-update-estimate="'+esc(c.id)+'">'+(owner?'Update actual balance':'View card')+'</button></div><div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Month</th><th>Opening</th><th>Interest estimate</th><th>Marked paid</th><th>Future payments</th><th>Estimated ending</th></tr></thead><tbody>'+e.months.map(m=>'<tr><td>'+esc(m.month)+(m.month===today().slice(0,7)?' · current':'')+'</td><td>'+money(m.opening)+'</td><td>'+money(m.interest)+'</td><td>'+money(m.paid)+'</td><td>'+money(m.planned)+'</td><td><strong>'+money(m.ending)+'</strong></td></tr>').join('')+'</tbody></table></div>';
  box.querySelector('[data-update-estimate]').onclick=()=>edit(c);
 }
 box.querySelector('#ccEstimateCard').onchange=show;show();
}
function edit(card) {
 selected=card; const c=card||{}, f=root.querySelector('#ccEdit');
 f.innerHTML='<h2 class="cc-wide">'+(card?'Update card':'Add a card')+'</h2><p class="cc-wide cc-small">Due each month: <strong>'+esc(dueDateLabel(c))+'</strong> · <a href="/control#bills">Manage in Bills</a></p>'+[['name','Card name','text'],['balance','Current balance','number'],['apr','APR (%)','number'],['payment','Monthly payment budget','number'],['limit','Credit limit (optional)','number'],['balanceAsOf','Balance as of','date']].map(([key,label,type])=>'<label '+(key==='name'?'class="cc-wide"':'')+'>'+label+'<input name="'+key+'" type="'+type+'" '+(type==='number'?'min="0" step=".01"':'')+' '+(key==='apr'?'max="100"':'')+' '+(key==='name'?'required maxlength="100"':'')+' value="'+esc(c[key]??(key==='balanceAsOf'?today():''))+'" '+(!owner?'disabled':'')+'></label>').join('')+'<label class="cc-wide">Status<select name="archived" '+(!owner?'disabled':'')+'><option value="false">Active</option><option value="true" '+(c.archived?'selected':'')+'>Archived / paid off</option></select></label><p class="cc-wide cc-small">Enter the statement or current balance you have verified. No account numbers are needed. These entries do not change your scheduled minimum payments.</p><div class="cc-wide" id="ccHistory">'+(c.history?.length?'<details><summary>Balance history ('+c.history.length+')</summary>'+c.history.slice().reverse().map(h=>'<p>'+esc(h.date)+' · '+money(h.balance)+'</p>').join('')+'</details>':'')+'</div><div class="cc-wide cc-small cc-error" id="ccEditError" role="alert"></div><div class="cc-actions cc-wide">'+(owner?'<button class="cc-primary" type="submit">Save card</button>':'')+'<button type="button" id="ccCancel">Close</button></div>';
 f.querySelector('#ccCancel').onclick=()=>root.querySelector('#ccDialog').close();
 f.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const b=e.submitter;b.disabled=true;try {const input=Object.fromEntries(new FormData(f));input.archived=input.archived==='true';input.paymentPlan=false;if(selected)input.id=selected.id;store=await api('',{revision:store.revision,card:input});root.querySelector('#ccDialog').close();render();notice('Card saved. Your calendar payments have not changed.');}catch(err){f.querySelector('#ccEditError').textContent=err.message;}finally{busy=false;b.disabled=false;}};
 f.querySelector('[name=balance]').addEventListener('input',()=>{const date=f.querySelector('[name=balanceAsOf]');if(date.value===c.balanceAsOf)date.value=today();});
 root.querySelector('#ccDialog').showModal();
}
function debtPlannerHtml() {
 const floor = document.getElementById('recommendationFloor')?.value || 950;
 return `<section class="cc-panel cc-debt-planner" data-debt-planner="regular">
   <div class="cc-eyebrow">DEBT PLANNER</div>
   <h2>Compare your payoff options</h2>
   <p>Compare interest savings, quick payoffs, and the monthly bills you could free up by clearing balances.</p>
   <form class="cc-debt-fields">
     <label>Extra each month<input name="extra" type="number" min="0" max="1000000" step=".01" value="0" required></label>
     <label>One-time extra toward debt<input name="lump" type="number" min="0" max="1000000" step=".01" value="0" required></label>
     <label>First payment date<input name="start" type="date" min="${today()}" value="${today()}" required></label>
     <label>Months of extras<input name="months" type="number" min="1" max="24" value="3" required></label>
     <label>Cash floor<input name="buffer" type="number" min="0" max="1000000" step=".01" value="${esc(floor)}" required></label>
     <button type="submit" class="cc-primary">Compare scenarios</button>
   </form>
   <p class="cc-small">Later payments use the same day of each month, or month-end if needed.</p>
   <div class="cc-debt-status" role="status"></div>
   <div class="cc-debt-results"></div>
 </section>`;
}

function bonusPlannerHtml() {
 return '<section class="cc-panel cc-debt-planner"><div class="cc-eyebrow">BONUS SANDBOX</div><h2>Turn your bonus into breathing room</h2><p>Plan gross and net pay, protect renovation money, and compare how to reduce monthly bills.</p><a href="/?view=bonus">Open bonus sandbox →</a></section>';
}

const strategyLabels = {baseline:'Current calendar', avalanche:'Avalanche', snowball:'Snowball', relief:'Monthly relief',lmcc:'LMCC first',custom:'Your allocation'};
function scenarioChart(result, cash = false, released = false) {
 const colors = ['#8a9ba6', '#55b99a', '#e59a7c', '#a99bdc', '#e4c478', '#69cde0'];
 const series = result.scenarios.map(plan => cash ? plan.monthly.map(row => released ? row.cashIfBillsStop : row.ending)
   : [result.starting, ...plan.monthly.map(row => row.debt)]);
 const values = series.flat();
 const low = cash ? Math.min(result.buffer, ...values) : 0;
 const high = Math.max(low + 1, ...values);
 const y = value => 128 - 113 * (value - low) / (high - low);
 const lines = series.map((balances, i) => {
   const points = balances.map((balance, index) => `${12 + 576 * index / Math.max(1, balances.length - 1)},${y(balance)}`).join(' ');
   return `<polyline points="${points}" fill="none" stroke="${colors[i]}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
 });
 const floor = cash ? `<path d="M12 ${y(result.buffer)}H588" stroke="currentColor" stroke-dasharray="5 5" opacity=".65"/>` : '';
 const title = cash ? (released ? 'Cash after confirmed payoffs stop bills' : 'Month-end cash') : 'Estimated remaining debt';
 const legend = result.scenarios.map((plan, i) => `<span><i style="background:${colors[i]}"></i>${(result.labels || strategyLabels)[plan.strategy]}</span>`);
 if (cash) legend.push(`<span>Dashed line · ${money(result.buffer)} cash floor</span>`);
 return `<figure class="cc-debt-chart">
   <figcaption>${title}</figcaption>
   <svg viewBox="0 0 600 140" role="img" aria-label="${title} by scenario. Exact values are in the monthly table.">
     <path d="M12 15H588 M12 72H588 M12 128H588" stroke="currentColor" opacity=".15"/>${floor}${lines.join('')}
   </svg>
   <div class="cc-debt-chart-range"><span>${money(low)}–${money(high)}</span><span>Through ${result.through}</span></div>
   <div class="cc-debt-legend">${legend.join('')}</div>
 </figure>`;
}

function debtPlanDetails(plan, baseline, result) {
 const months = plan.monthly.map((row, index) => {
   const before = baseline.monthly[index];
   return `<tr><td>${row.month}</td><td>${money(row.debt)}</td><td>${money(before.ending)}</td>
     <td>${money(row.ending)}</td><td>${money(row.ending - before.ending)}</td><td>${money(row.low)}</td><td>${money(row.possibleRelief)}</td><td>${money(row.cashIfBillsStop)}</td></tr>`;
 }).join('');
 const payments = plan.payments.map(payment => `<tr><td>${payment.date}</td><td>${esc(payment.name)}</td><td>${money(payment.amount)}</td></tr>`).join('');
 return `<h3>${strategyLabels[plan.strategy]} details</h3>
   ${plan.firstBelow ? `<p class="cc-error">Cash falls below ${money(result.buffer)} on ${plan.firstBelow}. Adjust the amount or timing to save this plan.</p>` : ''}
   ${payments ? `<details open><summary>Calendar payments · ${plan.payments.length} · ${money(plan.payments.reduce((sum, payment) => sum + payment.amount, 0))}</summary>
     <div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Date</th><th>Account</th><th>Extra</th></tr></thead><tbody>${payments}</tbody></table></div>
   </details>` : ''}
   <details open><summary>Monthly debt and cash flow</summary><div class="cc-table-wrap">
     <table class="cc-table"><thead><tr><th>Month</th><th>Debt left</th><th>Current cash ending</th><th>Scenario cash ending</th><th>Change</th><th>Lowest cash</th><th>Potential bill relief</th><th>Cash if cleared bills stop</th></tr></thead><tbody>${months}</tbody></table>
   </div></details>
   <details><summary>Payoff by account</summary><ul>${plan.accounts.map(card => `<li>${esc(card.name)} · ${card.paidOn || money(card.remaining) + ' left at forecast end'}</li>`).join('')}</ul></details>
   ${owner && plan.safe && payments ? '<button type="button" class="cc-primary" data-save-debt-plan>' + (result.bonus ? 'Add debt funding and payments to calendar' : 'Add these payments to calendar') + '</button>' : ''}`;
}

function bindDebtPlanner(section) {
 const form = section.querySelector('form'), box = section.querySelector('.cc-debt-results');
 const status = section.querySelector('.cc-debt-status');
 let version = 0;
 form.oninput = () => { version++; box.replaceChildren(); status.textContent = ''; };
 form.onsubmit = async event => {
   event.preventDefault();
   const request = ++version, planId = crypto.randomUUID();
   const { alreadyScheduled, ...fields } = Object.fromEntries(new FormData(form));
   const input = { ...fields, planId };
   if (section.dataset.debtPlanner === 'bonus' && !alreadyScheduled) input.bonus = fields.lump;
   const button = event.submitter;
   button.disabled = true;
   box.replaceChildren();
   status.textContent = 'Comparing against your calendar…';
   try {
     const result = await api('/debt-scenarios', input);
     if (request !== version) return;
     status.textContent = result.modeled ? '' : 'Add a current balance, balance date, and APR in Card details to begin.';
     if (!result.modeled) return;
     const [baseline] = result.scenarios;
     box.innerHTML = `<p class="cc-small">${result.modeled} accounts modeled through ${result.through}.${result.excluded.length ? ' Needs a balance, date, or APR: ' + result.excluded.map(esc).join(', ') + '.' : ''}${result.unlinked.length ? ' No linked bill: ' + result.unlinked.map(esc).join(', ') + '.' : ''} ${result.bonus ? ' Includes ' + money(result.bonus) + ' in expected income on ' + result.start + ' across all scenarios.' : ''}${result.reliefApproximate ? ' Monthly relief uses a ranked estimate for large card sets.' : ''} ${input.includeLmcc ? ' LMCC estimate starts at $3,000 in January with no interest assumed.' : ''}${result.lmccAssumed ? ' No 2027 LMCC payments were found. This preview assumes $250 at each month-end through December.' : ''} Estimates assume fixed APR and no new charges. Existing bills and scheduled payments stay in the cash forecast after a projected payoff. Potential bill relief shows scheduled payments after a projected payoff that you could remove once the issuer confirms the balance is cleared. Cash floor checks every day from the first added payment through the forecast end.</p>
       <div class="cc-debt-choices">${result.scenarios.map(plan => `<button type="button" class="cc-stat" data-strategy="${plan.strategy}" aria-pressed="false">
       <strong>${strategyLabels[plan.strategy]}</strong><span>${plan.payoffDate ? 'Paid off ' + plan.payoffDate : money(plan.remaining) + ' left at forecast end'}</span>
       <span>${money(plan.interest)} interest through forecast${plan.strategy !== 'baseline' ? ' · ' + money(baseline.interest - plan.interest) + ' saved' : ''}</span>
       <span>${plan.monthlyRelief > 0 ? money(plan.monthlyRelief) + '/mo potential relief from accounts cleared by extras' : '—'}</span>
       <span>Low cash ${money(plan.lowest)} on ${plan.lowestDate}</span>
       <span>${plan.safe ? 'Within cash floor' : 'Below cash floor'}</span></button>`).join('')}</div>
       <div class="cc-debt-charts">${scenarioChart(result)}${scenarioChart(result, true)}</div><div class="cc-debt-detail"></div>`;
     const choices = [...box.querySelectorAll('[data-strategy]')];
     function show(strategy) {
       const plan = result.scenarios.find(item => item.strategy === strategy);
       choices.forEach(choice => choice.setAttribute('aria-pressed', String(choice.dataset.strategy === strategy)));
       const detail = box.querySelector('.cc-debt-detail');
       detail.innerHTML = debtPlanDetails(plan, baseline, result);
       const save = detail.querySelector('[data-save-debt-plan]');
       if (save) save.onclick = async () => {
         if (busy || request !== version) return;
         busy = true;
         choices.forEach(choice => { choice.disabled = true; });
         save.disabled = true;
         try {
           const saved = await api('/debt-scenarios/save', {input, strategy, fingerprint:result.fingerprint, planId});
           version++;
           box.replaceChildren();
           status.textContent = saved.saved + ' payments' + (saved.bonusAdded ? ' and the debt funding deposit' : '') + ' added to your calendar.';
           await refreshPlanned();
         } catch (error) {
           status.textContent = error.message;
           save.disabled = false;
         } finally {
           choices.forEach(choice => { choice.disabled = false; });
           busy = false;
         }
       };
     }
     choices.forEach(choice => { choice.onclick = () => show(choice.dataset.strategy); });
     show(section.dataset.debtPlanner === 'bonus' ? 'relief' : 'avalanche');
   } catch (error) {
     if (request === version) status.textContent = error.message;
   } finally {
     button.disabled = false;
   }
 };
}
function renderBonusSandbox() {
 const draft = store.bonusDraft || {}, saved = draft.sandbox || {};
 const field = (name, label, value = '', extra = '') => `<label>${label}<input name="${name}" type="number" min="0" max="${name === 'withholding' ? 100 : 1000000}" step=".01" value="${esc(value)}" ${extra}></label>`;
 root.innerHTML = `<header class="cc-top"><div><div class="cc-eyebrow">MAKE ROOM FOR WHAT’S NEXT</div><h1>Bonus Sandbox</h1><p>Give every dollar a job. See which payoffs make everyday life easier.</p></div><div class="cc-actions"><a href="/?view=credit-cards">Card balances →</a><a href="/?view=liabilities">Liabilities →</a></div></header>
 <form id="bonusForm"><details id="bonusSetup" open><summary>Bonus amount &amp; savings earmarks</summary>
 <div class="bonus-setup"><section class="cc-panel"><div class="cc-eyebrow">01 · YOUR BONUS</div><h2>Start with take-home pay</h2><div class="cc-form">
 <label>Expected deposit date<input name="start" type="date" min="${today()}" max="2027-12-31" required value="${esc(draft.start || (today() < '2027-03-01' ? '2027-03-01' : today()))}"></label>
 <label>Net amount method<select name="netMode"><option value="actual">Enter expected / actual net</option><option value="estimate" ${saved.netMode === 'estimate' ? 'selected' : ''}>Estimate from gross</option></select></label>
 ${field('gross','Gross bonus (optional with known net)',saved.gross)}
 ${field('withholding','All-in deductions (%)',saved.withholding ?? '', 'placeholder="Your payroll estimate"')}
 ${field('net','Net bonus',saved.net, 'required')}
 </div><p class="cc-small">For an estimate, use your total expected deductions: federal, NJ, payroll taxes, retirement and benefits. Withholding is not your final tax rate. Replace the estimate with payroll’s net amount when available. <a href="https://www.irs.gov/publications/p15" target="_blank" rel="noopener">IRS withholding guide</a></p>
 <p class="cc-small">March 1 is a planning placeholder. Move it when your deposit date is known.</p></section>
 <section class="cc-panel"><div class="cc-eyebrow">02 · PROTECT YOUR PRIORITIES</div><h2>Decide what’s available</h2><div class="cc-form">
 ${field('reno','Home renovation savings',saved.reno ?? 0,'required')}
 ${field('reserve','Emergency savings',saved.reserve ?? 0,'required')}
 ${field('cushion','Keep in bills account',saved.cushion ?? 0,'required')}
 ${field('buffer','Minimum daily cash floor',draft.buffer ?? (document.getElementById('recommendationFloor')?.value || 950),'required')}
 </div><p class="cc-small">Renovation and emergency savings stay outside the bills forecast. The bills-account cushion stays available for future bills. Everything else becomes your debt budget.</p>
 <label class="bonus-check"><input type="checkbox" name="includeLmcc" ${draft.includeLmcc === false ? '' : 'checked'}> Compare 2027 LMCC dues</label>
 <label class="bonus-check"><input type="checkbox" name="alreadyScheduled" ${draft.alreadyScheduled ? 'checked' : ''}> Debt budget + bills cushion already on calendar</label>
 <p class="cc-small">If a full net bonus is already on the calendar, record the savings transfers there first. This checkbox assumes only the debt budget and bills cushion remain available.</p>
 </section></div>
 <section class="cc-panel bonus-envelope" aria-label="Bonus allocation"><div class="cc-eyebrow">YOUR BONUS, ASSIGNED</div><div id="bonusEnvelope" aria-live="polite"></div><div class="cc-actions"><button class="cc-primary" type="submit">Compare deployment plans</button><button type="button" id="bonusDraft">Save sandbox draft</button></div><p class="cc-small">Comparisons and drafts leave the calendar unchanged. Review a plan below before adding payments.</p></section>
 </details></form><div id="bonusStatus" class="cc-notice" role="status">${store.bonusDraft ? 'Your saved sandbox is ready to explore.' : 'Enter your bonus to start. Your current cards and eligible liabilities will be included.'}</div><div id="bonusResults"></div>`;
 const form = root.querySelector('#bonusForm'), status = root.querySelector('#bonusStatus'), box = root.querySelector('#bonusResults');
 let version = 0, allocations = draft.allocations || {};
 const read = () => {
   const f = Object.fromEntries(new FormData(form));
   return {start:f.start, buffer:f.buffer, includeLmcc:!!f.includeLmcc, alreadyScheduled:!!f.alreadyScheduled,
     extra:0, months:1, lump:0, allocations,
     sandbox:Object.fromEntries(['gross','netMode','withholding','net','reno','reserve','cushion'].map(key => [key,f[key]]))};
 };
 function envelope() {
   const f = read().sandbox, estimateNet = f.netMode === 'estimate';
   form.elements.withholding.disabled = !estimateNet;
   form.elements.withholding.required = estimateNet;
   form.elements.gross.required = estimateNet;
   form.elements.net.readOnly = estimateNet;
   if (estimateNet) form.elements.net.value = f.gross && f.withholding !== '' ? Math.max(0, Math.round(Number(f.gross) * (1 - Number(f.withholding) / 100) * 100) / 100) : '';
   const net = Number(form.elements.net.value), reno = Number(f.reno), reserve = Number(f.reserve), cushion = Number(f.cushion), debt = Math.round((net - reno - reserve - cushion) * 100) / 100;
   const slices = [['Renovations',reno,'#d6aa81'],['Emergency savings',reserve,'#a99bdc'],['Bills cushion',cushion,'#68c5d4'],['Debt budget',Math.max(0,debt),'#6ee3b4']];
   root.querySelector('#bonusEnvelope').innerHTML = `<div class="bonus-totals">${f.gross ? `<span>Deductions <strong>${money(Number(f.gross)-net)}</strong></span>` : ''}<span>Take-home <strong>${money(net)}</strong></span><span>Available for debt <strong>${money(debt)}</strong></span></div><div class="bonus-bar" role="img" aria-label="Net bonus divided between savings, bills cushion and debt">${slices.map(([label,value,color]) => `<span title="${label}: ${money(value)}" style="width:${net > 0 ? 100 * value / Math.max(net,reno+reserve+cushion) : 0}%;background:${color}"></span>`).join('')}</div><div class="cc-debt-legend">${slices.map(([label,value,color]) => `<span><i style="background:${color}"></i>${label} · ${money(value)}</span>`).join('')}</div>${debt < 0 ? '<p class="cc-error">Earmarks exceed take-home pay. Reduce an earmark to compare.</p>' : ''}`;
 }
 form.oninput = () => { version++; allocations = {}; box.replaceChildren(); status.textContent = 'Inputs changed. Compare again to refresh the plans.'; envelope(); };
 envelope();
 root.querySelector('#bonusDraft').onclick = async event => {
   if (!form.reportValidity() || busy) return;
   busy = true; event.target.disabled = true;
   try { const result = await api('/bonus-draft',{revision:store.revision,input:read()}); store.revision = result.revision; status.textContent = 'Sandbox draft saved. It will be available on your other devices.'; }
   catch(error) { status.textContent = error.message; }
   finally { busy = false; event.target.disabled = false; }
 };
 const labels = {baseline:'Hold budget in cash',relief:'Cash flow first',avalanche:'Interest first',snowball:'Smallest balances first',lmcc:'LMCC first',custom:'Your allocation'};
 async function compare() {
   const request = ++version, input = {...read(),planId:crypto.randomUUID()};
   const button = form.querySelector('[type=submit]'); button.disabled = true;
   status.textContent = 'Comparing debt, interest, and every projected cash day…'; box.replaceChildren();
   try {
     const result = await api('/debt-scenarios', input);
     if (request !== version) return;

     const baseline = result.scenarios[0], plans = result.scenarios.filter(p => p.strategy !== 'custom' || Object.values(allocations).some(v => Number(v) > 0));
     const planOrder = ['relief','avalanche','snowball','lmcc','custom','baseline']; plans.sort((a,b) => planOrder.indexOf(a.strategy) - planOrder.indexOf(b.strategy));
     const relief = result.scenarios.find(p => p.strategy === 'relief'), avalanche = result.scenarios.find(p => p.strategy === 'avalanche');
     const afterStart = plan => plan.monthly.filter(row => row.month >= result.start.slice(0,7));
     const gain = plan => afterStart(plan).reduce((sum,row) => sum + row.possibleRelief - (baseline.monthly.find(m => m.month === row.month)?.possibleRelief || 0),0);
     const lift = plan => { const rows = afterStart(plan).filter(row => row.month > result.start.slice(0,7)); return Math.max(0,...rows.map(row => row.possibleRelief - (baseline.monthly.find(m => m.month === row.month)?.possibleRelief || 0))); };
     const recommendation = relief?.monthlyRelief > 0 ? relief : avalanche;
     status.textContent = 'Comparison ready. Choose a plan to review its allocations and calendar impact.';
     box.innerHTML = `<section class="cc-panel" id="bonusDetail"></section>
     <section class="bonus-alternatives"><h2>Compare another approach</h2><div class="cc-debt-choices bonus-choices">${plans.map(plan => `<button type="button" class="cc-stat" data-bonus-strategy="${plan.strategy}" aria-pressed="false"><strong>${labels[plan.strategy]}</strong><span>${money(plan.deployed)} to debt</span><span>${money(gain(plan))} in earlier bill relief</span><span>${money(baseline.interest-plan.interest)} interest saved</span></button>`).join('')}</div></section>
     <details class="cc-panel bonus-assumptions"><summary>Compare debt and cash balance charts</summary><div class="cc-debt-charts">${scenarioChart({...result,scenarios:plans,labels})}${scenarioChart({...result,scenarios:plans,labels},true,true)}</div></details>
     <details class="cc-panel bonus-custom"><summary>Build your own allocation</summary><p>Choose amounts by account and compare your mix with the suggested plans. A partial payoff saves interest; no lower monthly payment is assumed.</p><div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Account</th><th>Estimated at deposit</th><th>APR</th><th>Scheduled monthly</th><th>Your extra</th></tr></thead><tbody>${(baseline.atDeployment || []).map(account => `<tr><td>${esc(account.name)}${account.temporary ? '<div class="cc-small">2027 dues only</div>' : ''}</td><td>${money(account.balance)}</td><td>${account.apr}%</td><td>${money(account.payment)}</td><td><input aria-label="Extra for ${esc(account.name)}" data-allocation="${esc(account.id)}" type="number" min="0" max="${account.balance}" step=".01" value="${esc(allocations[account.id] || 0)}"></td></tr>`).join('')}</tbody></table></div><p id="bonusCustomTotal" class="cc-small"></p><div class="cc-actions"><button type="button" data-copy-relief>Start from cash flow first</button><button type="button" class="cc-primary" data-compare-custom>Compare my allocation</button></div></details>
     <details class="cc-panel bonus-assumptions"><summary>Coverage and assumptions</summary><p>${result.modeled} accounts modeled. ${result.excluded.length ? 'Needs a verified balance, date or APR: ' + result.excluded.map(esc).join(', ') + '. ' : ''}${result.omitted?.length ? 'Excluded ongoing-charge liabilities or represented by the LMCC estimate: ' + result.omitted.map(esc).join(', ') + '. ' : ''}${result.unlinked.length ? 'No linked schedule; no bill relief assumed: ' + result.unlinked.map(esc).join(', ') + '. ' : ''}${result.lmccAssumed ? 'LMCC is previewed at $3,000 in January less $250 monthly installments. These assumed installment rows are not saved. ' : ''}LMCC relief ends December 2027; next year’s dues return. Fixed APRs, no new spending or fees, no automatic minimum-payment reductions on partial payoffs. Liability schedules use existing calendar payments only. ${result.reliefApproximate ? 'Large portfolios use an approximate relief ranking. ' : ''}Interest and relief are estimates through ${result.through}, not lifetime savings. Before paying, get current payoff amounts and check fees or promotional terms.</p><p><a href="https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/" target="_blank" rel="noopener">CFPB: debt reduction strategies</a> · <a href="https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/" target="_blank" rel="noopener">CFPB: protecting a cash reserve</a></p></details>`;
     const setup = root.querySelector('#bonusSetup');
     setup.open = false;
     setup.querySelector('summary').textContent = money(result.budget.net) + ' take-home · ' + money(result.budget.reno + result.budget.reserve) + ' to savings · ' + money(result.budget.cushion) + ' cushion · ' + money(result.budget.debt) + ' for debt — Edit';
     const choices = [...box.querySelectorAll('[data-bonus-strategy]')];
     function show(strategy) {
       const plan = result.scenarios.find(p => p.strategy === strategy);
       choices.forEach(b => b.setAttribute('aria-pressed',String(b.dataset.bonusStrategy === strategy)));
       const detail = box.querySelector('#bonusDetail');
       const months = afterStart(plan).map(row => { const before = baseline.monthly.find(m => m.month === row.month); return `<tr><td>${row.month}</td><td>${money(row.debt)}</td><td>${money(row.ending)}</td><td>${money(row.low)}</td><td>${money(row.possibleRelief)}</td><td>${money(row.cashIfBillsStop)}</td><td>${money(row.cashIfBillsStop - before.cashIfBillsStop)}</td></tr>`; }).join('');
       const reliefMonths = afterStart(plan).map(row => ({month:row.month, amount:Math.max(0,Math.round((row.possibleRelief-(baseline.monthly.find(m=>m.month===row.month)?.possibleRelief || 0))*100)/100)}));
       const next = reliefMonths.find(row => row.month > result.start.slice(0,7)) || reliefMonths[0];
       const monthLabel = month => new Date(month+'-01T12:00:00Z').toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
       const peak = Math.max(1,...reliefMonths.map(row=>row.amount));
       const beforeDebt = (baseline.atDeployment || []).reduce((sum,account)=>sum+account.balance,0);
       detail.innerHTML = `<div class="cc-eyebrow">${labels[strategy].toUpperCase()} · YOUR IMPACT</div>
       <div class="bonus-impact-head"><div><h2>${money(next?.amount || 0)}<span>less to pay in ${next ? monthLabel(next.month) : 'the next month'}</span></h2><p>Compared with keeping the debt budget in cash.</p></div><div class="bonus-impact-secondary"><span>Earlier bill relief through Dec 2027<strong>${money(gain(plan))}</strong></span><span>Interest saved through Dec 2027<strong>${money(baseline.interest-plan.interest)}</strong></span></div></div>
       <p class="bonus-condition">Estimated relief starts after payoff is confirmed and those scheduled bills stop.${plan.temporaryRelief ? ' LMCC relief ends December 2027.' : ''}</p>
       <div class="bonus-debt-change"><div><span>Debt before bonus payments</span><strong>${money(beforeDebt)}</strong></div><div><span>Debt after bonus payments</span><strong>${money(Math.max(0,beforeDebt-plan.deployed))}</strong></div></div>
       <div class="bonus-debt-bar" role="img" aria-label="${money(plan.deployed)} paid off from ${money(beforeDebt)} modeled debt"><span style="width:${beforeDebt ? Math.min(100,100*plan.deployed/beforeDebt) : 0}%"></span></div><p class="cc-small">${money(plan.deployed)} paid down on ${result.start} · ${money(plan.unusedBudget)} of the debt budget stays in bills cash.</p>
       <h3>Where the money goes</h3><div class="bonus-payoff-list">${plan.payments.map(payment => {const account=(baseline.atDeployment || []).find(a=>a.id===(payment.cardId || payment.debtAccountId || 'liability:'+payment.liabilityId));const cleared=account && Math.round(payment.amount*100)>=Math.round(account.balance*100);return `<article><div><strong>${esc(payment.name)}</strong><span>${cleared ? 'Balance cleared' : 'Balance reduced'}${cleared && account.payment ? ' · '+money(account.payment)+'/mo scheduled payment' : ''}</span></div><b>${money(payment.amount)}</b></article>`;}).join('') || '<p>Your debt budget stays in cash.</p>'}</div>
       <h3 class="bonus-timeline-title">When you feel the difference</h3><p class="cc-small">Extra room in each month’s budget versus holding cash. Estimates assume cleared bills stop.</p><div class="bonus-relief-timeline">${reliefMonths.map(row=>`<div><span>${monthLabel(row.month)}</span><div class="bonus-relief-track"><i style="width:${100*row.amount/peak}%"></i></div><strong>${money(row.amount)}</strong></div>`).join('')}</div>
       <details class="bonus-calendar-review"><summary>Review calendar changes &amp; add this plan</summary>
       <h3>Review what will be added</h3><p>${result.bonus ? `${money(result.bonus)} expected deposit on ${result.start}: debt budget plus bills cushion only.` : 'No bonus deposit will be added; you marked the funding as already on the calendar.'} Renovation ${money(result.budget.reno)} and emergency savings ${money(result.budget.reserve)} remain earmarked outside this forecast.</p>
       <div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Date</th><th>Pay account</th><th>Extra payment</th></tr></thead><tbody>${plan.payments.map(p => `<tr><td>${p.date}</td><td>${esc(p.name)}</td><td>${money(p.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No additional debt payments in this plan.</td></tr>'}</tbody></table></div>
       <p class="cc-small">Adding a plan schedules the deposit and extra payments. Existing recurring bills stay in the calendar until you confirm payoff and update them in <a href="/control#bills">Control Center</a>. This keeps estimated payoff relief separate from available cash.</p>
       ${plan.firstBelow ? `<p class="cc-error">The calendar falls below ${money(result.buffer)} on ${plan.firstBelow} while existing bills remain. Increase the bills cushion or revise the plan before adding it.</p>` : ''}
       ${owner && plan.safe && plan.payments.length ? '<button type="button" class="cc-primary" data-save-bonus>Add selected plan to calendar</button>' : ''}
       </details><details><summary>Detailed monthly calculations</summary><div class="cc-table-wrap"><table class="cc-table"><thead><tr><th>Month</th><th>Debt left</th><th>Cash: existing bills kept</th><th>Low cash: bills kept</th><th>Payments after payoff</th><th>Cash if payoffs confirmed</th><th>Change vs holding cash*</th></tr></thead><tbody>${months}</tbody></table></div><p class="cc-small">*Both plans include the same bonus funding and assume confirmed paid-off bills stop. Negative change shows cash used to repay debt. Payments after payoff include natural payoffs; scenario cards show only the earlier relief versus holding cash.</p></details>`;
       detail.querySelector('[data-save-bonus]')?.addEventListener('click',async event => {
         if (busy || request !== version) return;
         busy = true; event.target.disabled = true;
         try {
           const savedPlan = await api('/debt-scenarios/save',{input,strategy,fingerprint:result.fingerprint,planId:input.planId});
           version++; form.elements.alreadyScheduled.checked = true; choices.forEach(b => b.disabled = true);
           status.textContent = `${savedPlan.saved} debt payments${savedPlan.bonusAdded ? ' and the expected debt/cushion deposit' : ''} added to the calendar. Confirm payoffs before changing recurring bills.`;
           event.target.textContent = 'Plan added';
         } catch(error) {status.textContent = error.message;event.target.disabled = false;}
         finally {busy = false;}
       });
     }
     choices.forEach(b => b.onclick = () => show(b.dataset.bonusStrategy));
     show(Object.values(allocations).some(v => Number(v) > 0) ? 'custom' : recommendation.strategy);
     box.scrollIntoView({behavior:'smooth',block:'start'});
     function customTotal() { const total = Object.values(allocations).reduce((sum,v) => sum + Math.round(Number(v || 0)*100),0)/100; box.querySelector('#bonusCustomTotal').textContent = `${money(total)} assigned of ${money(result.budget.debt)} · ${money(result.budget.debt-total)} unassigned stays in bills cash`; }
     box.querySelectorAll('[data-allocation]').forEach(el => el.oninput = () => { allocations = {...allocations,[el.dataset.allocation]:el.value}; version++; choices.forEach(b => b.disabled=true); box.querySelector('[data-save-bonus]')?.remove(); status.textContent='Allocation changed. Compare your allocation to refresh the results.'; customTotal(); });
     box.querySelector('[data-copy-relief]').onclick = () => { allocations = Object.fromEntries(relief.payments.map(p => [p.cardId || p.debtAccountId || 'liability:'+p.liabilityId,p.amount])); box.querySelectorAll('[data-allocation]').forEach(el => {el.value = allocations[el.dataset.allocation] || 0;}); version++;choices.forEach(b => b.disabled=true);box.querySelector('[data-save-bonus]')?.remove();status.textContent='Cash-flow-first amounts copied. Adjust them and compare your allocation.';customTotal(); };
     box.querySelector('[data-compare-custom]').onclick = () => { const inputs=[...box.querySelectorAll('[data-allocation]')]; if(inputs.every(el => el.reportValidity()))compare(); };
     customTotal();
   } catch(error) { if(request === version)status.textContent = error.message; }
   finally {button.disabled=false;}
 }
 form.onsubmit = event => { event.preventDefault(); compare(); };
}

function options() {
 const result=preview.result, box=root.querySelector('#ccOptions');
 if(!preview.planIds)preview.planIds=result.options.map(()=>crypto.randomUUID());
 box.innerHTML='<p>'+(result.safe?'These options keep your chosen buffer through '+esc(result.checkedThrough)+'.':'No safe option at this amount and buffer. Try a smaller payment or a later range.')+'</p>'+result.options.map((o,i)=>'<article class="cc-option"><strong>'+esc(o.date)+' · '+money(o.amount)+'</strong><div>Ending that day: '+money(o.before)+' → '+money(o.after)+'</div><div class="cc-small">Lowest afterward: '+money(o.lowest)+' on '+esc(o.lowestDate)+'</div>'+(o.safe&&owner?'<button class="cc-primary" data-plan="'+i+'">Add this payment to calendar</button>':'')+'</article>').join('');
 box.querySelectorAll('[data-plan]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{const o=result.options[Number(b.dataset.plan)];await api('/payments',{...preview.input,...o,planId:preview.planIds[Number(b.dataset.plan)]});preview=null;box.innerHTML='<p>Payment added. Your balance is unchanged until you update it after posting.</p>';notice('Extra payment saved to the calendar.');await refreshPlanned();}catch(err){notice(err.message,true);}finally{busy=false;b.disabled=false;}});
}
function planned(){const box=root.querySelector('#ccPlanned');if(!box)return;const events=(snapshot?.data?.oneTimeEvents||[]).filter(e=>e.debtAccountId==='lmcc-dues-2027'||(e.creditCardId&&store.cards.some(c=>c.id===e.creditCardId))).sort((a,b)=>a.date.localeCompare(b.date));box.innerHTML=events.length?events.map(e=>'<p><strong>'+esc(e.date)+' · '+esc(e.name)+'</strong> · '+money(Math.abs(e.amount))+' <a href="/?view=calendar">Open calendar</a></p>').join(''):'<p class="cc-small">No additional payments planned yet.</p>';}
async function refreshPlanned(){const r=await fetch('/api/bills',{cache:'no-store',credentials:'same-origin'});if(r.ok){snapshot={data:await r.json()};planned();store=await api('');if (!bonusView) monthlyEstimates();}}
window.addEventListener('billsos:calendar-ready',e=>{snapshot=e.detail;planned();});
root.innerHTML='<p>Loading your accounts…</p>';
api('').then(s=>{store=s;snapshot=window.BillsOSReportsSnapshot;render();}).catch(e=>{root.textContent=e.message;});
})();
