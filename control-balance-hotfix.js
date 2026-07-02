(function(){
  function wireBalanceFix(){
    var btn=document.getElementById('balanceFixSave');
    if(!btn||btn.dataset.hotfix==='1')return false;
    btn.dataset.hotfix='1';
    btn.addEventListener('click',async function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      var meta=document.getElementById('balanceFixMeta');
      var amountEl=document.getElementById('balanceFixAmount');
      var dateEl=document.getElementById('balanceFixDate');
      var noteEl=document.getElementById('balanceFixNote');
      var monthEl=document.getElementById('previewMonth');
      var amount=Number(String(amountEl&&amountEl.value||'').replace(/[$,]/g,''));
      var date=dateEl&&dateEl.value;
      var month=monthEl&&monthEl.value;
      var note=noteEl&&noteEl.value||'Balance correction';
      if(!Number.isFinite(amount)||amount===0){if(meta)meta.textContent='Enter a positive or negative correction amount.';return;}
      if(!date||!month||date.slice(0,7)!==month){if(meta)meta.textContent='Use a date in the selected month.';return;}
      var required=['oneId','oneName','oneDate','oneAmount','oneType','oneNotes'];
      for(var i=0;i<required.length;i++){
        if(!document.getElementById(required[i])){if(meta)meta.textContent='One-time item form is not ready. Reload Control Center.';return;}
      }
      if(typeof window.saveOneFromForm!=='function'||typeof window.saveData!=='function'){
        if(meta)meta.textContent='Save functions are not ready. Reload Control Center.';
        return;
      }
      if(meta)meta.textContent='Saving calculation-only correction...';
      document.getElementById('oneId').value='';
      document.getElementById('oneName').value=note;
      document.getElementById('oneDate').value=date;
      document.getElementById('oneAmount').value=amount;
      document.getElementById('oneType').value=amount>=0?'income':'bill';
      document.getElementById('oneNotes').value='Manual balance correction; calculation-only';
      window.saveOneFromForm();
      await window.saveData();
      if(typeof window.renderPreview==='function')window.renderPreview();
      if(meta)meta.textContent='Saved. It will affect balances without showing as a calendar action.';
    },true);
    return true;
  }
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    if(wireBalanceFix()||tries>80)clearInterval(timer);
  },250);
})();
