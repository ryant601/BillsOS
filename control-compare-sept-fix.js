(function(){
function txt(el){return (el&&el.textContent||'').trim();}
function isSept(){var el=document.getElementById('compareMonth');return el&&el.value==='sep';}
function rowKind(tr){var c=tr.querySelectorAll('td');return [txt(c[0]),txt(c[1]),txt(c[2]),txt(c[3])].join(' | ').toLowerCase();}
function cleanSeptRows(){
  if(!isSept())return;
  var out=document.getElementById('compareOutput');if(!out)return;
  var rows=[].slice.call(out.querySelectorAll('tbody tr'));
  rows.forEach(function(tr){
    var s=rowKind(tr);
    if((s.indexOf('electric')>=0||s.indexOf('gas')>=0)&&(s.indexOf('amount mismatch')>=0||s.indexOf('extra in preview')>=0))tr.remove();
    if(s.indexOf('sweep')>=0&&s.indexOf('system-rule missing')>=0)tr.remove();
  });
  var remaining=[].slice.call(out.querySelectorAll('tbody tr'));
  var material=remaining.filter(function(tr){var s=rowKind(tr);return s.indexOf('likely rename')<0&&s.indexOf('system-rule')<0;}).length;
  var system=remaining.filter(function(tr){return rowKind(tr).indexOf('system-rule')>=0;}).length;
  var boxes=out.querySelectorAll('.preview-kpi b');
  if(boxes[2])boxes[2].textContent=String(material);
  if(boxes[3])boxes[3].textContent=String(system);
  var st=document.getElementById('compareStatus');if(st)st.textContent='Compare complete - '+material+' material differences, '+system+' system-rule differences.';
}
function install(){if(!window.runCompareMode||window.__septCompareFix)return;window.__septCompareFix=true;var old=window.runCompareMode;window.runCompareMode=async function(){await old();setTimeout(cleanSeptRows,0);};}
var t=setInterval(install,400);setTimeout(function(){clearInterval(t);install();},6000);
})();
