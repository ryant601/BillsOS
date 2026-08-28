'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const originalStatic = express.static;

const SPENDING_PATH = path.join(__dirname, 'spending', 'index.html');

function spendingNavPatch(html) {
  const patch = `<script id="billsosSpendingNavPatch">
(function(){
  function patchSidebar(){
    var nav=document.querySelector('.bo-nav');
    if(!nav)return;
    var links=[].slice.call(nav.querySelectorAll('a'));
    var calendar=links.find(function(a){return /Calendar/i.test(a.textContent||'')});
    var bills=links.find(function(a){return /Bills/i.test(a.textContent||'')});
    var spending=links.find(function(a){return /Everyday Spending/i.test(a.textContent||'')});
    if(!spending){
      spending=document.createElement('a');
      spending.href='/spending/';
      spending.target='_self';
      spending.innerHTML='<span class="bo-icon">◉</span><span>Everyday Spending</span>';
      if(bills) nav.insertBefore(spending,bills);
      else if(calendar&&calendar.nextSibling) nav.insertBefore(spending,calendar.nextSibling);
      else nav.appendChild(spending);
    }
    links=[].slice.call(nav.querySelectorAll('a'));
    links.forEach(function(a){a.classList.remove('is-active')});
    spending.classList.add('is-active');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(patchSidebar,0)},{once:true});
  else setTimeout(patchSidebar,0);
})();
</script>`;
  return html.includes('id="billsosSpendingNavPatch"') ? html : html.replace('</body>', patch+'\n</body>');
}

express.static = function billsOsStatic(root, options) {
  const middleware = originalStatic.call(express, root, options);
  return function billsOsStaticWithSpendingShell(req, res, next) {
    const url = String(req.url || '').split('?')[0];
    if (url === '/spending/' || url === '/spending/index.html') {
      try {
        let html = fs.readFileSync(SPENDING_PATH, 'utf8');
        html = spendingNavPatch(html);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.status(200).send(html);
      } catch (err) {
        return next(err);
      }
    }
    return middleware(req, res, next);
  };
};
