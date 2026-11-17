'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { debtScenarios, register, projection } = require('../credit-card-manager');

const date = '2026-11-10';
const input = { extra: 250, lump: 100, buffer: 950, start: '2026-11-30', months: 3 };
const cards = [
  { id: 'high', sourceBillId: 'high-bill', name: 'High APR', balance: 2000, apr: 25, balanceAsOf: date },
  { id: 'small', sourceBillId: 'small-bill', name: 'Small balance', balance: 500, apr: 0, balanceAsOf: date }
];
function fixture() {
  return {
    bills: [
      { id: 'high-bill', name: 'High APR', amount: 75, dueDay: 20, startMonth: '2026-11' },
      { id: 'small-bill', name: 'Small balance', amount: 25, dueDay: 25, startMonth: '2026-11' }
    ],
    income: [],
    oneTimeEvents: [{ id: 'opening', name: 'Opening balance', type: 'balance-opening-adjustment',
      date: '2026-06-01', amount: 5000, requestedBalance: 5000 }]
  };
}

test('the same dated budget targets different cards and reports the cash cost', () => {
  const data = fixture();
  const [base, avalanche, snowball] = debtScenarios(data, cards, input, {}, date).scenarios;
  assert.equal(avalanche.payments[0].cardId, 'high');
  assert.equal(snowball.payments[0].cardId, 'small');
  assert.equal(avalanche.payments[0].amount, 350);
  assert.equal(avalanche.monthly[0].ending, base.monthly[0].ending - 350);
  assert.ok(avalanche.interest < base.interest);
  assert.ok(avalanche.interest < snowball.interest);
  assert.ok(snowball.accounts.find(card => card.name === 'Small balance').paidOn);
  assert.equal(data.oneTimeEvents.length, 1);
});

test('month-end rolls into short months and a later low day blocks adding a plan', () => {
  const data = fixture();
  data.oneTimeEvents.push({ id: 'later', name: 'Later expense', type: 'adjustment', date: '2027-07-01', amount: -2500 });
  const result = debtScenarios(data, cards, { ...input, start:'2027-01-31', months:2, buffer:1000 }, {}, date);
  const plan = result.scenarios[1];
  assert.deepEqual([...new Set(plan.payments.map(payment => payment.date))], ['2027-01-31', '2027-02-28']);
  assert.equal(plan.safe, false);
  assert.ok(plan.firstBelow >= '2027-07-01');
  assert.throws(() => debtScenarios(data, cards, { ...input, start:'2027-12-31' }, {}, date), /fewer months/);
});

test('saving the selected scenario uses the previewed cash projection, revalidates changes, and is retry safe', () => {
  let data = fixture(), writes = 0;
  const routes = new Map();
  register({ get(){}, post(url, handler){ routes.set(url, handler); } }, {
    readStore: () => ({ cards }), readBills: () => structuredClone(data),
    writeBills: value => { writes++; data = value; return data; }, currentDate: () => date
  });
  function post(path, body) {
    const res = { code:200, status(code){ this.code=code;return this; }, json(value){ this.value=value; } };
    routes.get('/api/credit-cards/debt-scenarios' + path)({body}, res);
    return res;
  }
  const planId = 'test-payment-plan-123';
  const bonusInput = { ...input, bonus: 1200, planId };
  const result = post('', bonusInput).value;
  const payload = {input:bonusInput, strategy:'snowball', fingerprint:result.fingerprint, planId};
  data.oneTimeEvents.push({id:'change',name:'New expense',type:'adjustment',date:'2026-12-01',amount:-10});
  assert.equal(post('/save', payload).code, 409);
  assert.equal(writes, 0);
  data.oneTimeEvents.pop();
  const scenario = result.scenarios.find(plan => plan.strategy === 'snowball');
  const saved = post('/save', payload).value;
  assert.equal(saved.saved, scenario.payments.length);
  assert.equal(saved.bonusAdded, true);
  assert.equal(data.oneTimeEvents.filter(event => event.debtPlanId === planId && event.type === 'income').length, 1);
  assert.equal(post('/save', payload).value.duplicate, true);
  assert.equal(writes, 1);
  assert.equal(projection(data).at(-1).ending, scenario.monthly.at(-1).ending);
});

test('a bonus comparison favors whole-card payoff for recurring relief and shows conditional future cash', () => {
  const result = debtScenarios(fixture(), cards, { ...input, extra: 0, lump: 600, bonus: 1000, months: 1 }, {}, date);
  const [base, avalanche, , relief] = result.scenarios;
  assert.equal(result.bonusEvent.amount, 1000);
  assert.equal(base.monthly[0].ending, 5900);
  assert.equal(avalanche.payments[0].cardId, 'high');
  assert.equal(relief.payments[0].cardId, 'small');
  assert.equal(relief.payments[0].amount, 475);
  assert.equal(relief.monthlyRelief, 25);
  assert.equal(relief.monthly[1].cashIfBillsStop, relief.monthly[1].ending + 25);
  assert.equal(relief.monthly[1].possibleRelief, 25);
  assert.equal(relief.monthly[0].ending, avalanche.monthly[0].ending);
});

test('March bonus compares LMCC payoff after earlier dues and shows the remaining months of relief', () => {
  const data = fixture();
  const result = debtScenarios(data, cards, {...input, start:'2027-03-01', months:1,
    extra:0, lump:2700, bonus:2700, includeLmcc:'on'}, {}, date);
  const plan = result.scenarios.find(item => item.strategy === 'lmcc');
  assert.equal(result.lmccAssumed,true);
  assert.equal(plan.payments[0].debtAccountId,'lmcc-dues-2027');
  assert.equal(plan.payments[0].amount,2500);
  assert.equal(plan.payments.reduce((sum,payment) => sum + payment.amount,0),2700);
  assert.equal(plan.monthly.find(month => month.month === '2027-03').possibleRelief >= 250,true);
  assert.ok(plan.monthlyRelief >= 250);
  assert.equal(data.oneTimeEvents.length,1);
});

test('bonus reconciles gross, net and savings earmarks without funding them into bill cash', () => {
  const {bonusBudget} = require('../credit-card-manager');
  const sandbox = {gross:10000,netMode:'estimate',withholding:35,reno:2000,reserve:500,cushion:1000};
  assert.deepEqual(bonusBudget(sandbox), {gross:10000,net:6500,netMode:'estimate',withholding:35,deductions:3500,reno:2000,reserve:500,cushion:1000,debt:3000,funding:4000});
  const result = debtScenarios(fixture(),cards,{...input,sandbox}, {},date);
  assert.equal(result.bonusEvent.amount,4000);
  assert.equal(result.budget.debt,3000);
  assert.ok(result.scenarios.every(p => p.deployed <= 3000));
  assert.equal(result.scenarios[0].monthly[0].ending,8900);
  const scheduled = debtScenarios(fixture(),cards,{...input,sandbox,alreadyScheduled:true},{},date);
  assert.equal(scheduled.bonusEvent,null);
  assert.throws(() => bonusBudget({...sandbox,reno:7000}),/earmarks exceed/);
  assert.throws(() => bonusBudget({...sandbox,withholding:101}),/deduction estimate/);
  assert.throws(() => bonusBudget({...sandbox,netMode:'actual',net:10001}),/cannot exceed/);
});

test('custom deployment preserves unassigned cash and does not invent partial-payoff relief', () => {
  const sandbox = {net:2000,netMode:'actual',reno:200,reserve:200,cushion:100};
  const baseInput = {...input,start:'2026-11-30',sandbox,allocations:{high:100,small:200}};
  const result = debtScenarios(fixture(),cards,baseInput,{},date);
  const custom = result.scenarios.find(p => p.strategy==='custom');
  assert.equal(custom.deployed,300);
  assert.equal(custom.unusedBudget,1200);
  assert.equal(custom.monthlyRelief,0);
  assert.equal(custom.atDeployment.find(a=>a.id==='small').balance,475);
  assert.throws(() => debtScenarios(fixture(),cards,{...baseInput,allocations:{high:1501}}, {},date), /fit the debt budget/);
  assert.throws(() => debtScenarios(fixture(),cards,{...baseInput,allocations:{missing:1}}, {},date), /listed accounts/);
  assert.throws(() => debtScenarios(fixture(),cards,{...baseInput,allocations:{small:-1}}, {},date), /fit the debt budget/);
});

test('sandbox includes eligible liabilities, saves typed events, revalidates earmarks and persists a draft', () => {
  let data=fixture(), tracker={cards,revision:0}, writes=0;
  const routes=new Map();
  data.bills.push({id:'deck',name:'Deck installment',amount:150,dueDay:28,startMonth:'2026-11',endMonth:'2027-07'});
  const liability={id:'deck-liability',name:'Deck installment',balance:800,apr:0,balanceAsOf:date,linkedBillId:'deck'};
  register({get(){},post(url,fn){routes.set(url,fn);}}, {
    readStore:()=>structuredClone(tracker),writeStore:s=>{tracker=s;},
    readLiabilities:()=>({items:[liability,{...liability,id:'ongoing',name:'Ongoing dues',monthlyCharge:250}]}),
    readBills:()=>structuredClone(data),writeBills:s=>{data=s;writes++;},currentDate:()=>date
  });
  const post=(path,body)=>{const res={code:200,status(c){this.code=c;return this;},json(v){this.value=v;}};routes.get('/api/credit-cards/'+path)({body},res);return res;};
  const planId='bonus-sandbox-test-123';
  const sandbox={gross:3000,net:2000,netMode:'actual',reno:200,reserve:200,cushion:100};
  const request={...input,start:'2026-11-30',sandbox,allocations:{'liability:deck-liability':650},planId};
  const result=post('debt-scenarios',request).value;
  assert.ok(result.omitted.includes('Ongoing dues'));
  const custom=result.scenarios.find(p=>p.strategy==='custom');
  assert.equal(custom.payments[0].liabilityId,'deck-liability');
  assert.equal(custom.monthlyRelief,150);
  assert.equal(custom.atDeployment.find(a=>a.id==='liability:deck-liability').balance,650);
  assert.equal(post('bonus-draft',{revision:0,input:request}).code,200);
  assert.deepEqual(tracker.bonusDraft.sandbox,sandbox);
  assert.equal(post('bonus-draft',{revision:0,input:request}).code,409);
  const payload={input:request,strategy:'custom',fingerprint:result.fingerprint,planId};
  assert.equal(post('debt-scenarios/save',{...payload,input:{...request,sandbox:{...sandbox,reno:201}}}).code,409);
  assert.equal(post('debt-scenarios/save',payload).code,200);
  assert.equal(writes,1);
  const event=data.oneTimeEvents.find(e=>e.liabilityId==='deck-liability');
  assert.equal(event.amount,-650);
  assert.equal(event.creditCardId,undefined);
  assert.equal(data.oneTimeEvents.find(e=>e.type==='income').amount,1600);
  assert.equal(projection(data).at(-1).ending,custom.monthly.at(-1).ending);
  assert.equal(post('debt-scenarios/save',payload).value.duplicate,true);
  assert.equal(writes,1);
});

test('finite liability installments create relief only in their scheduled months', () => {
  const data=fixture();
  data.oneTimeEvents.push(...['2026-12-15','2027-01-15'].map((day,i)=>({id:'installment-'+i,liabilityId:'fixed',name:'Fixed plan',date:day,amount:-100,type:'adjustment'})));
  const portfolio=[...cards,{id:'liability:fixed',liabilitySourceId:'fixed',name:'Fixed plan',balance:200,apr:0,balanceAsOf:date,paymentPlan:false}];
  const result=debtScenarios(data,portfolio,{...input,start:'2026-11-30',sandbox:{net:200,netMode:'actual',reno:0,reserve:0,cushion:0},allocations:{'liability:fixed':200}}, {},date);
  const plan=result.scenarios.find(p=>p.strategy==='custom');
  assert.equal(plan.monthlyRelief,100);
  assert.equal(plan.monthly.find(m=>m.month==='2026-12').possibleRelief,100);
  assert.equal(plan.monthly.find(m=>m.month==='2027-01').possibleRelief,100);
  assert.equal(plan.monthly.find(m=>m.month==='2027-02').possibleRelief,0);
  data.oneTimeEvents.push({...result.bonusEvent});
  assert.throws(()=>debtScenarios(data,portfolio,{...input,start:'2026-11-30',sandbox:{net:200,netMode:'actual',reno:0,reserve:0,cushion:0}}, {},date),/already on this date/);
});
