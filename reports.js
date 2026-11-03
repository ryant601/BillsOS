(function(root,factory){
'use strict';
var api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(!root.document)return;
root.BillsOSReports=api;
if(new URLSearchParams(root.location.search).get('view')!=='reports')return;
document.documentElement.classList.add('reports-active');
var snapshot=null,report=null,active='overview',query='',kindFilter='',categoryFilter='',cardFilter='',busy=false;
var main=document.createElement('main');main.id='billsReports';main.innerHTML='<div class="rp-loading" role="status">Loading your calendar reports…</div>';
function mount(){if(!main.parentNode&&document.body)document.body.appendChild(main)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value||0)}
function compact(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value||0)}
function monthLabel(key,short){return new Date(key+'-01T12:00:00').toLocaleDateString('en-US',{month:short?'short':'long',year:'numeric'})}
function dateLabel(iso){return new Date(iso+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function selected(){var from=main.querySelector('[name=from]'),to=main.querySelector('[name=to]');return report.months.filter(function(m){return(!from||m.key>=from.value)&&(!to||m.key<=to.value)})}
function rowsFor(months){return months.flatMap(function(m){return m.rows})}
function pct(n,d){return d?Math.round(n/d*100):0}
function card(title,value,note,cls){return '<article class="rp-kpi '+(cls||'')+'"><span>'+title+'</span><strong>'+value+'</strong><small>'+note+'</small></article>'}
function chartBars(months){
 var max=Math.max(1,...months.flatMap(function(m){return[m.income,m.outflow]}));
 return '<div class="rp-legend"><span class="rp-dot income"></span>Income <span class="rp-dot outflow"></span>Outflow incl. transfers</div><div class="rp-bars" aria-label="Monthly income and outflow">'+months.map(function(m){return '<button type="button" class="rp-bar-month" data-select-month="'+m.key+'" aria-label="'+esc(monthLabel(m.key)+': income '+money(m.income)+', outflow '+money(m.outflow))+'"><span class="rp-bar-values">'+compact(m.income)+'<br>'+compact(m.outflow)+'</span><span class="rp-bar-pair"><i class="income" style="height:'+Math.max(1,m.income/max*100)+'%"></i><i class="outflow" style="height:'+Math.max(1,m.outflow/max*100)+'%"></i></span><span>'+esc(monthLabel(m.key,true))+'</span></button>'}).join('')+'</div>';
}
function lineChart(days){
 if(!days.length)return '<p>No days in this range.</p>';
 var values=days.map(function(d){return d.ending}),min=Math.min(0,...values),max=Math.max(1,...values),range=max-min||1,w=980,h=220;
 var x=function(i){return 52+i*(w-74)/Math.max(1,days.length-1)},y=function(v){return 15+(max-v)/range*(h-48)};
 var points=values.map(function(v,i){return x(i).toFixed(1)+','+y(v).toFixed(1)}).join(' ');
 var low=days.reduce(function(a,b){return a.ending<=b.ending?a:b});
 return '<div class="rp-line-wrap"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc('Projected daily ending balance. Lowest '+money(low.ending)+' on '+dateLabel(low.date))+'"><line x1="52" x2="960" y1="'+y(0)+'" y2="'+y(0)+'" stroke="var(--rp-line)" stroke-dasharray="4 4"/><text x="2" y="22">'+esc(compact(max))+'</text><text x="2" y="'+Math.min(h-10,y(0)+4)+'">$0</text><polyline points="'+points+'" fill="none" stroke="var(--rp-accent)" stroke-width="2.8" stroke-linejoin="round"/><text x="52" y="215">'+esc(dateLabel(days[0].date))+'</text><text x="960" y="215" text-anchor="end">'+esc(dateLabel(days[days.length-1].date))+'</text></svg></div><p class="rp-chart-note">Lowest <a href="/?view=calendar&focus='+low.date+'">'+money(low.ending)+' · '+dateLabel(low.date)+'</a>. Includes every calendar row and saved balance adjustment.</p>';
}
function panel(title,sub,body,cls){return '<section class="rp-panel '+(cls||'')+'"><div class="rp-panel-head"><div><h2>'+title+'</h2>'+(sub?'<p>'+sub+'</p>':'')+'</div></div>'+body+'</section>'}
function monthlyTable(months){return '<div class="rp-scroll"><table><thead><tr><th>Month</th><th>Income</th><th>Bills & expenses</th><th>Transfers out</th><th>Net cash flow</th><th>Adjustments*</th><th>Ending</th><th>Lowest day</th></tr></thead><tbody>'+months.map(function(m){return '<tr><th><button type="button" class="rp-text-button" data-select-month="'+m.key+'">'+monthLabel(m.key,true)+'</button></th><td>'+money(m.income)+'</td><td>'+money(m.expenses)+'</td><td>'+money(m.transferOut)+'</td><td class="'+(m.net<0?'rp-negative':'rp-positive')+'">'+money(m.net)+'</td><td>'+money(m.adjustments)+'</td><td>'+money(m.ending)+'</td><td><a href="/?view=calendar&focus='+m.lowDate+'">'+money(m.low)+'</a></td></tr>'}).join('')+'</tbody></table></div><p class="rp-footnote">*Adjustments reconcile opening/ending corrections and resets. Net cash flow = income + transfers in − bills & expenses − transfers out.</p>'}
function groups(rows,field){var map={};rows.filter(function(r){return r.kind==='expense'}).forEach(function(r){var key=r[field]||'Uncategorized';map[key]=(map[key]||0)+r.cents});return Object.entries(map).map(function(p){return{name:p[0],amount:p[1]/100}}).sort(function(a,b){return b.amount-a.amount})}
function ranking(items,action,total){var max=Math.max(1,...items.map(function(i){return i.amount}));return '<div class="rp-rankings">'+items.map(function(item){return '<button type="button" data-'+action+'="'+esc(item.name)+'" class="rp-ranking"><span class="rp-ranking-head"><b>'+esc(item.name)+'</b><strong>'+money(item.amount)+'</strong></span><span class="rp-track"><i style="width:'+item.amount/max*100+'%"></i></span><small>'+pct(item.amount,total)+'% of bills & expenses · View transactions →</small></button>'}).join('')+'</div>'}
function overview(months){
 var rows=rowsFor(months),days=months.flatMap(function(m){return m.days}),income=months.reduce((n,m)=>n+m.income,0),out=months.reduce((n,m)=>n+m.outflow,0),net=months.reduce((n,m)=>n+m.net,0),expense=months.reduce((n,m)=>n+m.expenses,0),cards=rows.filter(r=>r.creditCard).reduce((n,r)=>n+r.cents,0)/100,low=days.reduce((a,b)=>a.ending<=b.ending?a:b),future=days.filter(d=>d.date>=today()),negative=future.filter(d=>d.ending<0),auto=rows.filter(r=>r.kind==='expense'&&r.payMethod==='auto').reduce((n,r)=>n+r.cents,0)/100;
 var best=months.reduce((a,b)=>a.net>b.net?a:b),worst=months.reduce((a,b)=>a.low<b.low?a:b);
 return '<div class="rp-kpis">'+card('Scheduled income',money(income),months.length+' selected months','income')+card('Scheduled outflow',money(out),'Bills, expenses & transfers')+card('Net cash flow',money(net),'Before balance corrections',net<0?'negative':'income')+card('Lowest projected day',money(low.ending),dateLabel(low.date),low.ending<0?'negative':'')+'</div>'+
 panel('Your cash-flow rhythm','Click a month to zoom in. Amounts include completed and upcoming scheduled transactions.',chartBars(months))+
 '<div class="rp-two">'+panel('Balance runway','Daily projected ending balance',lineChart(days))+
 panel('What stands out','Based on the selected period','<div class="rp-insights"><article><span>Credit cards</span><strong>'+money(cards)+'</strong><p>'+pct(cards,expense)+'% of bills & expenses. <button class="rp-text-button" type="button" data-tab="cards">Explore cards →</button></p></article><article><span>Auto-pay expenses</span><strong>'+money(auto)+'</strong><p>'+pct(auto,expense)+'% of scheduled bills & expenses have auto pay recorded.</p></article><article><span>Strongest cash-flow month</span><strong>'+monthLabel(best.key,true)+'</strong><p>'+money(best.net)+' net before adjustments.</p></article><article><span>Future pressure</span><strong>'+negative.length+' negative days</strong><p>'+future.filter(d=>d.ending>=0&&d.ending<300).length+' additional days below $300. Tightest selected month: '+monthLabel(worst.key,true)+'.</p></article></div>')+'</div>'+
 panel('Month-by-month ledger','The full bridge from income to projected balance.',monthlyTable(months));
}
function categories(months){var rows=rowsFor(months),total=months.reduce((n,m)=>n+m.expenses,0);return '<div class="rp-two">'+panel('Where the money goes','Transfers and balance corrections excluded.',ranking(groups(rows,'category'),'category',total))+panel('Largest payees','Scheduled payments, not everyday-account merchant spending.',ranking(groups(rows,'name').slice(0,18),'vendor',total))+'</div>'}
function cards(months){
 var rows=rowsFor(months).filter(r=>r.creditCard),names=Array.from(new Set(rows.map(r=>r.name))).sort(),total=rows.reduce((n,r)=>n+r.cents,0)/100;
 var table='<div class="rp-scroll"><table class="rp-card-matrix"><thead><tr><th>Card</th>'+months.map(m=>'<th>'+monthLabel(m.key,true)+'</th>').join('')+'<th>Total</th></tr></thead><tbody>'+names.map(function(name){var amounts=months.map(m=>m.rows.filter(r=>r.creditCard&&r.name===name).reduce((n,r)=>n+r.cents,0)/100);return '<tr><th><button type="button" class="rp-text-button" data-card="'+esc(name)+'">'+esc(name)+'</button></th>'+amounts.map(n=>'<td>'+(n?money(n):'—')+'</td>').join('')+'<td><strong>'+money(amounts.reduce((n,v)=>n+v,0))+'</strong></td></tr>'}).join('')+'<tr class="rp-total"><th>Total</th>'+months.map(m=>'<td>'+money(m.rows.filter(r=>r.creditCard).reduce((n,r)=>n+r.cents,0)/100)+'</td>').join('')+'<td>'+money(total)+'</td></tr></tbody></table></div>';
 return '<div class="rp-kpis">'+card('Card payments',money(total),'Selected period')+card('Monthly average',money(total/months.length),'Scheduled payment average')+card('Cards represented',String(names.length),'Includes joint & store cards')+card('Share of expenses',pct(total,months.reduce((n,m)=>n+m.expenses,0))+'%','Excludes spending transfers')+'</div>'+panel('Credit-card payment map','Click a card to see its transactions. These are planned payments, not statement balances or payoff predictions.',table);
}
function forecast(months){
 var from=months[0].key,to=months[months.length-1].key,todayMonth=today().slice(0,7),endings=api.scheduledEndings(snapshot.data.bills||[],from,to,todayMonth);
 var rows=rowsFor(months),fixed=rows.filter(r=>r.kind==='expense'&&r.recurring),one=rows.filter(r=>r.kind==='expense'&&!r.recurring),risks=months.flatMap(m=>m.days.filter(d=>d.date>=today()&&d.ending<300)).sort((a,b)=>a.ending-b.ending).slice(0,12);
 var endingsHtml=endings.length?'<div class="rp-ending-list">'+endings.sort((a,b)=>a.endMonth.localeCompare(b.endMonth)).map(b=>'<article><span class="rp-ending-date">'+monthLabel(b.endMonth,true)+'</span><div><h3>'+esc(b.name)+'</h3><p>Last configured month · '+money(Math.abs(Number(b.amount||0)))+' recurring payment</p></div><a href="/control#bills">Review</a></article>').join('')+'</div>':'<p class="rp-empty">No recurring payments are configured to end in this range.</p>';
 return '<div class="rp-kpis">'+card('Recurring expenses',money(fixed.reduce((n,r)=>n+r.cents,0)/100),'Source: recurring bills')+card('One-time expenses',money(one.reduce((n,r)=>n+r.cents,0)/100),'Includes saved split payment parts')+card('Payments scheduled to end',String(endings.length),'Within the selected future range')+card('Future days below $300',String(months.flatMap(m=>m.days).filter(d=>d.date>=today()&&d.ending<300).length),'Fixed reference, separate from your recommendation floor')+'</div><div class="rp-two">'+panel('Room opening up','End dates reflect your configuration. They do not confirm the debt is paid off.',endingsHtml)+panel('Days to watch','Future projected days below $300, sorted by lowest balance.',risks.length?'<div class="rp-ending-list">'+risks.map(d=>'<article><div><h3>'+dateLabel(d.date)+'</h3><p>'+ (d.ending<0?'Negative projected balance':'Low projected balance')+'</p></div><a href="/?view=calendar&focus='+d.date+'">'+money(d.ending)+' →</a></article>').join('')+'</div>':'<p class="rp-empty">No future days below $300 in this range.</p>')+'</div>'+panel('Projected month-end path','All scheduled transactions and adjustments included.',lineChart(months.map(m=>({date:m.days.slice(-1)[0].date,ending:m.ending}))));
}
function transactionTable(rows){
 var selectedRows=rows.filter(function(r){return(!query||(r.name+' '+r.category+' '+r.notes).toLowerCase().includes(query.toLowerCase()))&&(!kindFilter||r.kind===kindFilter)&&(!categoryFilter||r.category===categoryFilter)&&(!cardFilter||r.name===cardFilter)});
 return '<p class="rp-chart-note">'+selectedRows.length+' transactions · Net '+money(selectedRows.reduce((n,r)=>n+r.amount,0))+(categoryFilter?' · Category: '+esc(categoryFilter):'')+(cardFilter?' · Payee: '+esc(cardFilter):'')+'</p><div class="rp-scroll"><table><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Kind</th><th>Payment method</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+selectedRows.map(r=>'<tr><td><a href="/?view=calendar&focus='+r.date+'">'+dateLabel(r.date)+'</a></td><th>'+esc(r.name)+'</th><td>'+esc(r.category)+'</td><td>'+esc(r.kind)+'</td><td>'+esc(r.payMethod==='auto'?'Auto pay':r.payMethod==='manual'?'Manual':'—')+'</td><td class="'+(r.amount<0?'rp-negative':'rp-positive')+'">'+money(r.amount)+'</td><td class="rp-note">'+esc(r.notes)+'</td></tr>').join('')+'</tbody></table></div>';
}
function transactions(months){return panel('Transaction explorer','Every calendar row, including corrections and transfers. Dates reflect saved moves.','<div class="rp-search"><label>Search<input id="rpSearch" type="search" value="'+esc(query)+'" placeholder="Payee, category or note"></label><label>Kind<select id="rpKind"><option value="">All kinds</option>'+['expense','income','transfer','adjustment'].map(k=>'<option '+(kindFilter===k?'selected':'')+' value="'+k+'">'+k+'</option>').join('')+'</select></label><button type="button" class="rp-button" data-clear>Clear filters</button></div><div id="rpTransactionRows">'+transactionTable(rowsFor(months))+'</div>')}

function whatif(months){
 var rows=rowsFor(months),cards=Array.from(new Set(rows.filter(r=>r.creditCard).map(r=>r.name))).sort(),from=months[0].key+'-01',last=months[months.length-1].days.slice(-1)[0].date,start=today()>=from&&today()<=last?today():from;
 return '<div class="rp-scenario-banner"><strong>A sandbox for your next move.</strong><span>Try a plan, compare the tradeoffs. Nothing here changes your calendar.</span></div>'+
 panel('Cash-flow experiment','Preview the effect on daily balances and month-end cash. Saved corrections stay fixed.',
 '<form id="rpCashScenario" class="rp-scenario-form"><label>Start date<input name="start" type="date" min="'+from+'" max="'+last+'" value="'+start+'" required></label><label>Reduce monthly payments in<select name="group"><option value="expenses">All bills & expenses</option><option value="cards">Credit cards only</option></select></label><label>Monthly reduction ($)<input name="reduction" type="number" min="0" step="0.01" value="0"></label><label>Extra monthly income ($)<input name="income" type="number" min="0" step="0.01" value="0"></label><label>Extra debt payment / month ($)<input name="extra" type="number" min="0" step="0.01" value="0"></label><label>Extra income / payment day<input name="day" type="number" min="1" max="31" step="1" value="27"></label><button class="rp-button rp-primary" type="submit">Compare cash flow</button></form><p class="rp-footnote">Reductions apply proportionally to matching scheduled payments from the start date, capped at the amount scheduled. Extra income and debt payments fall on the chosen day. A lower debt payment is only a hypothetical cash-flow change—it does not assume a lender accepts it.</p><div id="rpCashResult" aria-live="polite"></div>')+
 panel('Debt payoff lab','Enter current balances and APRs for the debts you want to model. Leave unused debts blank.',
 '<form id="rpDebtScenario"><div class="rp-scroll"><table class="rp-debt-inputs"><thead><tr><th>Debt</th><th>Balance ($)</th><th>APR (%)</th><th>Monthly payment ($)</th></tr></thead><tbody>'+cards.map(function(name,index){var payment=months[0].rows.filter(r=>r.creditCard&&r.name===name).reduce((n,r)=>n+r.cents,0)/100;return '<tr data-debt-row><th>'+esc(name)+'</th><td><input aria-label="'+esc(name)+' balance" name="balance" type="number" min="0" step="0.01" placeholder="Enter balance"></td><td><input aria-label="'+esc(name)+' APR" name="apr" type="number" min="0" max="100" step="0.01" placeholder="Enter APR"></td><td><input aria-label="'+esc(name)+' monthly payment" name="payment" type="number" min="0.01" step="0.01" value="'+payment.toFixed(2)+'"></td></tr>'}).join('')+'<tr data-debt-row><th><input name="debtName" aria-label="Other debt name" placeholder="Other debt (optional)" maxlength="80"></th><td><input name="balance" aria-label="Other debt balance" type="number" min="0" step="0.01" placeholder="Balance"></td><td><input name="apr" aria-label="Other debt APR" type="number" min="0" max="100" step="0.01" placeholder="APR"></td><td><input name="payment" aria-label="Other debt monthly payment" type="number" min="0.01" step="0.01" placeholder="Payment"></td></tr></tbody></table></div><div class="rp-scenario-form rp-debt-controls"><label>Extra monthly payment ($)<input name="debtExtra" type="number" min="0" step="0.01" value="100"></label><label>One-time payment now ($)<input name="lump" type="number" min="0" step="0.01" value="0"></label><label>Payoff approach<select name="strategy"><option value="avalanche">Avalanche · highest APR first</option><option value="snowball">Snowball · smallest balance first</option></select></label><button class="rp-button rp-primary" type="submit">Compare payoff plans</button></div><p class="rp-footnote">Monthly estimate using APR ÷ 12, no new purchases or fees, and a constant total payment budget. Freed payments roll into the next debt in both plans. Payment amounts start from the first selected month and can be edited. Inputs are not saved or sent to a third-party service.</p></form><div id="rpDebtResult" aria-live="polite"></div>');
}
function scenarioCash(form){
 var result=main.querySelector('#rpCashResult');
 try{
 var months=selected(),settings={start:form.elements.start.value,group:form.elements.group.value,reduction:Number(form.elements.reduction.value),income:Number(form.elements.income.value),extra:Number(form.elements.extra.value),day:Number(form.elements.day.value)},changed=api.cashScenario(months,settings);
 var delta=changed.reduce((n,m)=>n+m.change,0),low=Math.min(...changed.map(m=>m.low)),negative=changed.reduce((n,m)=>n+m.negativeDays,0);
 result.innerHTML='<div class="rp-kpis rp-scenario-results">'+card('Change by range end',money(delta),'Cumulative cash difference',delta<0?'negative':'income')+card('Scenario lowest day',money(low),'Within the selected range',low<0?'negative':'')+card('Negative days',String(negative),'Scenario projected days')+card('Final ending balance',money(changed.slice(-1)[0].ending),'Including the experiment')+'</div><div class="rp-scroll"><table><thead><tr><th>Month</th><th>Current ending</th><th>Scenario ending</th><th>Scenario lowest</th><th>Negative days</th></tr></thead><tbody>'+changed.map((m,i)=>'<tr><th>'+monthLabel(m.key,true)+'</th><td>'+money(months[i].ending)+'</td><td>'+money(m.ending)+'</td><td class="'+(m.low<0?'rp-negative':'')+'">'+money(m.low)+'</td><td>'+m.negativeDays+'</td></tr>').join('')+'</tbody></table></div>';
 }catch(e){result.innerHTML='<p role="alert" class="rp-negative">'+esc(e.message)+'</p>'}
}
function payoffLine(base,plan){
 var length=Math.max(base.path.length,plan.path.length),max=Math.max(1,base.initial),w=980,h=220;
 function points(items){return Array.from({length:length},(_,i)=>{var value=i<items.length?items[i].balance:0;return(52+i*908/Math.max(1,length-1)).toFixed(1)+','+(15+(1-value/max)*155).toFixed(1)}).join(' ')}
 return '<div class="rp-legend"><span class="rp-dot outflow"></span>Current budget <span class="rp-dot income"></span>With extra payments</div><div class="rp-line-wrap"><svg viewBox="0 0 980 220" role="img" aria-label="Comparison of remaining debt over time"><text x="2" y="22">'+compact(max)+'</text><text x="2" y="174">$0</text><polyline points="'+points(base.path)+'" fill="none" stroke="var(--rp-out)" stroke-width="2.5"/><polyline points="'+points(plan.path)+'" fill="none" stroke="var(--rp-green)" stroke-width="2.5"/><text x="52" y="211">Start</text><text x="960" y="211" text-anchor="end">Month '+(length-1)+'</text></svg></div>';
}
function scenarioDebt(form){
 var result=main.querySelector('#rpDebtResult');
 try{
 var debts=Array.from(form.querySelectorAll('[data-debt-row]')).filter(row=>Number(row.querySelector('[name=balance]').value)>0).map(function(row){var apr=row.querySelector('[name=apr]').value,payment=row.querySelector('[name=payment]').value,name=row.querySelector('[name=debtName]')?.value||row.querySelector('th').textContent;if(apr===''||payment==='')throw new Error('Enter APR and monthly payment for every debt with a balance.');return{name:name||'Other debt',balance:Number(row.querySelector('[name=balance]').value),apr:Number(apr),payment:Number(payment)}});
 var strategy=form.elements.strategy.value,base=api.debtPlan(debts,0,0,strategy),plan=api.debtPlan(debts,Number(form.elements.debtExtra.value),Number(form.elements.lump.value),strategy);
 var payoff=plan.paidOff?plan.months+' months':'Not cleared within 50 years',saved=base.paidOff&&plan.paidOff?Math.max(0,base.months-plan.months)+' months sooner':'See plan limits below',interest=base.paidOff&&plan.paidOff?money(Math.max(0,base.interest-plan.interest)):'—',totalPayment=debts.reduce((n,d)=>n+d.payment,0)+Number(form.elements.debtExtra.value);
 result.innerHTML='<div class="rp-kpis rp-scenario-results">'+card('Time to debt-free',payoff,saved)+card('Estimated interest saved',interest,'Compared with the current payment budget','income')+card('Monthly debt budget',money(totalPayment),'Freed payments roll forward')+card('First-month outlay',money(plan.path[1]?.paid||plan.initialPayment),'Includes the one-time payment')+'</div>'+payoffLine(base,plan)+(!base.paidOff||!plan.paidOff?'<p class="rp-negative">At least one plan does not clear the debt within 600 months. The budget may not cover interest; these results are incomplete.</p>':'')+'<div class="rp-scroll"><table><thead><tr><th>Debt</th><th>Starting balance</th><th>Scenario payoff month</th></tr></thead><tbody>'+plan.debts.map(d=>'<tr><th>'+esc(d.name)+'</th><td>'+money(d.initial)+'</td><td>'+(d.paidMonth==null?'Beyond model horizon':d.paidMonth===0?'One-time payment':'Month '+d.paidMonth)+'</td></tr>').join('')+'</tbody></table></div><p class="rp-footnote">This estimates debt reduction only. Use the cash-flow experiment above with the extra monthly payment to check affordability. No balance or APR was inferred from the calendar.</p>';
 }catch(e){result.innerHTML='<p role="alert" class="rp-negative">'+esc(e.message)+'</p>'}
}

function renderContent(){var months=selected(),content=main.querySelector('#rpContent');main.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===active?'page':'false'));if(!months.length){content.innerHTML='<p class="rp-empty">Choose a valid month range.</p>';return}content.innerHTML=active==='overview'?overview(months):active==='categories'?categories(months):active==='cards'?cards(months):active==='forecast'?forecast(months):active==='whatif'?whatif(months):transactions(months);main.querySelector('#rpRangeLabel').textContent=monthLabel(months[0].key)+' — '+monthLabel(months[months.length-1].key)}
function render(){
 var current=today().slice(0,7),future=report.months.filter(m=>m.key>=current),start=(future[0]||report.months[0]).key,end=(future.find(m=>m.key===String(Number(current.slice(0,4))+1)+'-'+current.slice(5))||future[future.length-1]||report.months[report.months.length-1]).key;
 var options=report.months.map(m=>'<option value="'+m.key+'">'+monthLabel(m.key)+'</option>').join('');
 main.innerHTML='<header class="rp-header"><div><span class="rp-eyebrow">BILLSOS / REPORTS</span><h1>See the bigger picture.</h1><p>Your cash flow, commitments and breathing room.</p></div><div class="rp-header-actions"><button class="rp-button" type="button" data-export>Export CSV</button><button class="rp-button" type="button" data-print>Print</button></div></header><section class="rp-controls"><div><label>From<select name="from">'+options+'</select></label><label>Through<select name="to">'+options+'</select></label></div><div class="rp-presets"><button type="button" data-range="month">This month</button><button type="button" data-range="year">Next 12 months</button><button type="button" data-range="all">All months</button></div></section><nav class="rp-tabs" aria-label="Report views">'+[['overview','Overview'],['categories','Categories & vendors'],['cards','Credit cards'],['forecast','Forecast'],['whatif','What if'],['transactions','Transactions']].map(t=>'<button type="button" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</nav><div class="rp-range-heading"><span id="rpRangeLabel"></span><span>Calendar projections · updated '+esc(snapshot.data.updatedAt?new Date(snapshot.data.updatedAt).toLocaleString():'just now')+'</span></div><div id="rpContent"></div><footer class="rp-disclaimer">These reports describe your saved BillsOS plan. Completed checks do not establish bank-posted activity. Future amounts stay as configured; no interest, changing minimums or unrecorded purchases are estimated.</footer>';
 main.querySelector('[name=from]').value=start;main.querySelector('[name=to]').value=end;renderContent();
}
function accept(next){snapshot=next;report=api.analyze(next);if(!report.months.length){main.innerHTML='<p class="rp-empty">No calendar data is available.</p>';return}render()}
root.addEventListener('billsos:calendar-ready',event=>accept(event.detail));
root.addEventListener('billsos:calendar-error',event=>{main.innerHTML='<p class="rp-empty" role="alert">Reports could not load. '+esc(event.detail)+' <button type="button" data-retry>Retry</button></p>'});
if(root.BillsOSReportsSnapshot)accept(root.BillsOSReportsSnapshot);
main.addEventListener('submit',function(event){if(event.target.id==='rpCashScenario'){event.preventDefault();scenarioCash(event.target)}if(event.target.id==='rpDebtScenario'){event.preventDefault();scenarioDebt(event.target)}});
main.addEventListener('change',function(event){if(event.target.matches('[name=from],[name=to]')){if(main.querySelector('[name=from]').value>main.querySelector('[name=to]').value)main.querySelector('[name=to]').value=main.querySelector('[name=from]').value;renderContent()}if(event.target.id==='rpKind'){kindFilter=event.target.value;main.querySelector('#rpTransactionRows').innerHTML=transactionTable(rowsFor(selected()))}});
main.addEventListener('input',function(event){if(event.target.id==='rpSearch'){query=event.target.value;main.querySelector('#rpTransactionRows').innerHTML=transactionTable(rowsFor(selected()))}});
main.addEventListener('click',function(event){
 var b=event.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-retry'))root.location.reload();
 if(b.dataset.tab){active=b.dataset.tab;renderContent()}
 if(b.dataset.selectMonth){main.querySelector('[name=from]').value=b.dataset.selectMonth;main.querySelector('[name=to]').value=b.dataset.selectMonth;renderContent()}
 if(b.dataset.range){var current=today().slice(0,7),future=report.months.filter(m=>m.key>=current),chosen=b.dataset.range==='all'?report.months:b.dataset.range==='month'?future.slice(0,1):future.slice(0,12);if(chosen.length){main.querySelector('[name=from]').value=chosen[0].key;main.querySelector('[name=to]').value=chosen[chosen.length-1].key;renderContent()}}
 if(b.dataset.category||b.dataset.vendor||b.dataset.card){categoryFilter=b.dataset.category||'';cardFilter=b.dataset.vendor||b.dataset.card||'';query='';kindFilter='';active='transactions';renderContent();main.querySelector('#rpContent').scrollIntoView({behavior:'smooth',block:'start'})}
 if(b.hasAttribute('data-clear')){query='';kindFilter='';categoryFilter='';cardFilter='';renderContent()}
 if(b.hasAttribute('data-print'))root.print();
 if(b.hasAttribute('data-export')){var rows=rowsFor(selected()),lines=active==='transactions'?[['Date','Transaction','Category','Kind','Payment method','Amount','Notes']].concat(rows.filter(r=>(!query||(r.name+' '+r.category+' '+r.notes).toLowerCase().includes(query.toLowerCase()))&&(!kindFilter||r.kind===kindFilter)&&(!categoryFilter||r.category===categoryFilter)&&(!cardFilter||r.name===cardFilter)).map(r=>[r.date,r.name,r.category,r.kind,r.payMethod,r.amount.toFixed(2),r.notes])):[['Month','Income','Bills and expenses','Transfers in','Transfers out','Net cash flow','Adjustments','Ending balance','Lowest balance','Lowest date','Card payments']].concat(selected().map(m=>[m.key,m.income,m.expenses,m.transferIn,m.transferOut,m.net,m.adjustments,m.ending,m.low,m.lowDate,m.rows.filter(r=>r.creditCard).reduce((n,r)=>n+r.cents,0)/100]));var csv=lines.map(line=>line.map(api.csvCell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='BillsOS-'+active+'-'+selected()[0].key+'-to-'+selected().slice(-1)[0].key+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}
});
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function isCard(name){return /^(amex|american express|citi\b|capital one\b|discover\b|apple card\b|macy|firestone\b|paypal credit)/i.test(name)}
function csvCell(value){var s=String(value==null?'':value);if(/^[=+@\t\r]/.test(s)||/^-(?!\d+(?:\.\d+)?$)/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function analyze(snapshot){
 var raw=snapshot.data||{},sources=new Map();(raw.bills||[]).forEach(b=>sources.set(b.id,{row:b,recurring:true}));(raw.oneTimeEvents||[]).forEach(b=>sources.set(b.id,{row:b,recurring:false}));(raw.income||[]).forEach(b=>sources.set(b.id,{row:b,recurring:true}));
 var months=(snapshot.months||[]).map(function(m){
  var rows=(m.rows||[]).map(function(row){
   var source=sources.get(row.sourceId)||{},original=source.row||{},name=String(row.name||''),type=String(original.type||row.type||'').toLowerCase(),amount=Math.round(Number(row.amount||0)*100)/100;
   var correction=/balance-opening|balance-correction/.test(type)||/balance correction|balance adjustment|balance reconciliation|ending balance|beginning balance/i.test(name);
   // The legacy engine calls all one-time adjustments balance-correction; use the original row to distinguish actual expenses.
   if(type==='adjustment'&&!/balance|reconciliation|correction/i.test(name))correction=false;
   var transfer=/transfer|funding|sweep/i.test(type+' '+name)||/fund spending account|xfer to spending/i.test(name);
   var kind=correction?'adjustment':transfer?'transfer':amount>0?'income':'expense';
   var creditCard=kind==='expense'&&isCard(name),category=String(original.category||row.category||'').trim();
   if(creditCard)category='Credit cards';
   else if(kind==='transfer')category='Account transfers';
   else if(kind==='adjustment')category='Balance adjustments';
   else if(kind==='income')category=category||'Income';
   else if(!category||category==='Debt'){category=/mortgage|hoa/i.test(name)?'Housing':/f-?150|gt500|jeep/i.test(name)?'Vehicles':/upstart|loan/i.test(name)?'Loans':/klarna|affirm|pay in 4|tickpick|kalahari/i.test(name)?'Installments & BNPL':category==='Debt'?'Other debt':'Uncategorized'}
   var method=String(row.payMethod||original.payMethod||original.paymentMethod||'').toLowerCase().replace(/[\s_-]/g,'');
   return {date:row.iso||row.date,name:name,amount:amount,cents:Math.abs(Math.round(amount*100)),kind:kind,category:category,creditCard:creditCard,payMethod:/^(auto|autopay|automatic)$/.test(method)?'auto':method==='manual'?'manual':'',recurring:!!source.recurring,notes:String(row.notes||original.notes||''),sourceId:row.sourceId||''};
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  var sum=(kind,positive)=>rows.filter(r=>r.kind===kind&&(positive==null||(r.amount>0)===positive)).reduce((n,r)=>n+r.cents,0)/100;
  var income=sum('income'),expenses=sum('expense'),transferIn=sum('transfer',true),transferOut=sum('transfer',false),days=(m.days||[]).map(d=>({date:d.date,ending:Math.round(Number(d.ending)*100)/100})),low=days.length?days.reduce((a,b)=>a.ending<=b.ending?a:b):{date:m.key+'-01',ending:0},ending=Math.round(Number(m.ending||0)*100)/100,starting=Math.round(Number(m.starting||0)*100)/100,net=Math.round((income+transferIn-expenses-transferOut)*100)/100;
  return {key:m.key,rows:rows,days:days,income:income,expenses:expenses,transferIn:transferIn,transferOut:transferOut,outflow:Math.round((expenses+transferOut)*100)/100,net:net,starting:starting,ending:ending,adjustments:Math.round((ending-starting-net)*100)/100,low:low.ending,lowDate:low.date};
 }).sort((a,b)=>a.key.localeCompare(b.key));
 return{months:months};
}

function cashScenario(months,settings){
 if(!months.length||!settings.start||!Number.isInteger(settings.day)||settings.day<1||settings.day>31||[settings.reduction,settings.income,settings.extra].some(v=>!Number.isFinite(v)||v<0))throw new Error('Enter a valid start date, day, and nonnegative amounts.');
 var offset=0;
 return months.map(function(m){
  var eligible=m.rows.filter(r=>r.kind==='expense'&&r.date>=settings.start&&(settings.group!=='cards'||r.creditCard)),total=eligible.reduce((n,r)=>n+r.cents,0),reduction=Math.min(total,Math.round(settings.reduction*100)),changes={};
  var distributed=0,cumulative=0;
  eligible.forEach(function(r){cumulative+=r.cents;var target=Math.round(reduction*cumulative/total),share=target-distributed;distributed=target;changes[r.date]=(changes[r.date]||0)+share});
  var [year,month]=m.key.split('-').map(Number),day=Math.min(settings.day,new Date(year,month,0).getDate()),date=m.key+'-'+String(day).padStart(2,'0'),extra=Math.round((settings.income-settings.extra)*100);
  if(date>=settings.start)changes[date]=(changes[date]||0)+extra;
  var firstOffset=offset,days=m.days.map(function(d){offset+=changes[d.date]||0;return{date:d.date,ending:Math.round((d.ending*100+offset))/100}});
  return{key:m.key,ending:Math.round(m.ending*100+offset)/100,low:Math.min(...days.map(d=>d.ending)),negativeDays:days.filter(d=>d.ending<0).length,change:(offset-firstOffset)/100};
 });
}
function debtPlan(inputs,extra,lump,strategy){
 if(!inputs.length)throw new Error('Enter a balance for at least one debt.');
 if(!Number.isFinite(extra)||extra<0||!Number.isFinite(lump)||lump<0)throw new Error('Enter nonnegative extra payment amounts.');
 var debts=inputs.map(function(d){if(!Number.isFinite(d.balance)||d.balance<=0||!Number.isFinite(d.apr)||d.apr<0||d.apr>100||!Number.isFinite(d.payment)||d.payment<=0)throw new Error('Each debt needs a positive balance and payment, and an APR from 0% to 100%.');return{name:d.name,balance:Math.round(d.balance*100),initial:d.balance,apr:d.apr,payment:Math.round(d.payment*100),paidMonth:null}});
 var initial=debts.reduce((n,d)=>n+d.balance,0),budget=debts.reduce((n,d)=>n+d.payment,0)+Math.round(extra*100),interest=0,path=[{month:0,balance:initial/100,paid:0}],initialPayment=0;
 function order(){return debts.filter(d=>d.balance>0).sort((a,b)=>strategy==='snowball'?a.balance-b.balance||b.apr-a.apr:b.apr-a.apr||a.balance-b.balance)}
 function apply(amount,month){var paid=0;for(var d of order()){var payment=Math.min(amount,d.balance);d.balance-=payment;amount-=payment;paid+=payment;if(!d.balance)d.paidMonth=month;if(!amount)break}return paid}
 initialPayment=apply(Math.round(lump*100),0);
 path[0].balance=debts.reduce((n,d)=>n+d.balance,0)/100;
 var months=0;
 while(debts.some(d=>d.balance>0)&&months<600){
  months++;var paid=0,available=budget;
  debts.filter(d=>d.balance>0).forEach(function(d){var charge=Math.round(d.balance*d.apr/1200);d.balance+=charge;interest+=charge});
  for(var d of debts.filter(d=>d.balance>0)){var payment=Math.min(available,d.payment,d.balance);available-=payment;d.balance-=payment;paid+=payment;if(!d.balance)d.paidMonth=months}
  paid+=apply(available,months);
  path.push({month:months,balance:debts.reduce((n,d)=>n+d.balance,0)/100,paid:(paid+(months===1?initialPayment:0))/100});
 }
 return{paidOff:debts.every(d=>!d.balance),months:months,interest:interest/100,path:path,initial:initial/100,initialPayment:initialPayment/100,debts:debts.map(d=>({name:d.name,initial:d.initial,paidMonth:d.paidMonth}))};
}


function scheduledEndings(bills,from,to,current){
 return bills.filter(function(b){
  if(!b.endMonth||b.endMonth<from||b.endMonth>to||b.endMonth<current||b.active===false)return false;
  var name=String(b.name||'').trim().toLowerCase(),parts=b.endMonth.split('-').map(Number),next=new Date(parts[0],parts[1],1),nextMonth=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0');
  return !bills.some(other=>other.id!==b.id&&other.active!==false&&String(other.name||'').trim().toLowerCase()===name&&(!other.startMonth||other.startMonth<=nextMonth)&&(!other.endMonth||other.endMonth>b.endMonth));
 });
}

return{analyze:analyze,isCard:isCard,csvCell:csvCell,cashScenario:cashScenario,debtPlan:debtPlan,scheduledEndings:scheduledEndings};
});
