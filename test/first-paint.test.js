'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const output=cp.execFileSync(process.execPath,['-e',`require('./html-hotfix-loader');require('./cache-coherence-preload');const fs=require('fs');process.stdout.write(JSON.stringify(['generated-v5.html','control.html'].map(f=>fs.readFileSync(f,'utf8'))))`],{cwd:root,encoding:'utf8'});
const pages=JSON.parse(output);
test('first response contains the final shell styling and body class before browser initialization',()=>{
 for(const html of pages){
  const head=html.slice(0,html.indexOf('</head>'));
  assert.match(head,/<style id="boStyles">[\s\S]*body\.bo-app/);
  assert.equal((html.match(/<style id="boStyles">/g)||[]).length,1);
  assert.match(html,/<body[^>]*class="[^"]*bo-app/);
  assert.match(head,/id="billsosRouteBoot"/);assert.match(head,/data-billsos-view="home"/);
  assert.match(head,/localStorage\.getItem\("billsos-theme-v2"\)/);
  assert.match(head,/id="boFont"/);
  const ui=html.match(/<script id="billsosAppUi">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(ui,/DOMContentLoaded/);assert.match(ui,/\n  install\(\);/);
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
 }
});
test('initial route selection suppresses the calendar under Home and tracker pages',()=>{
 const script=pages[0].match(/<script id="billsosRouteBoot">([\s\S]*?)<\/script>/)[1];
 for(const view of ['home','calendar','credit-cards','liabilities','reports']){
  const attrs={},classes=[];vm.runInNewContext(script,{location:{pathname:'/',search:'?view='+view},URLSearchParams,document:{documentElement:{setAttribute:(k,v)=>attrs[k]=v,classList:{add:c=>classes.push(c)}}}});
  assert.equal(attrs['data-billsos-view'],view);
  assert.deepEqual(classes,['credit-cards','liabilities','reports'].includes(view)?[view+'-active']:[]);
 }
 assert.match(pages[1].slice(0,pages[1].indexOf('</head>')),/id="billsosDesignCss"/);
});

test('Home refreshes metrics on data readiness without delayed markup replacement',()=>{
 const fs=require('node:fs'),source=fs.readFileSync(path.join(root,'html-hotfix-loader.js'),'utf8'),income=fs.readFileSync(path.join(root,'income-14day-home.js'),'utf8');
 assert.doesNotMatch(source,/setTimeout\(renderMetrics/);
 assert.match(source,/billsos:calendar-ready',renderMetrics/);
 assert.match(source,/new CustomEvent\('billsos:home-metrics-ready'\)/);
 assert.match(income,/addEventListener\('billsos:home-metrics-ready',finalize\)/);
 assert.doesNotMatch(income,/2600|settleTimer/);
});
