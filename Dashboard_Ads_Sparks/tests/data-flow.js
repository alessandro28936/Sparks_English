(() => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);},saved=view;
 try{
  navigate('data');const panel=document.querySelector('.data-flow');
  check('Data connection explicitly names Raw Data',panel?.textContent.includes('Ads are loaded from Raw Data'));
  const loadedRows=[...panel.querySelectorAll('.source-coverage tbody td.num')].reduce((sum,td)=>sum+Number(td.textContent.replace(/\D/g,'')),0);
  check('Account coverage reconciles to all normalized Raw Data rows',loadedRows===rows.length);
  check('CSV and manual routes are distinguished',panel.textContent.includes('does not replace the contents of an Import tab')&&panel.textContent.includes('Pasting alone does not update Raw Data'));
  check('Supporting sales reports are disclosed',panel.textContent.includes('Report Totals')&&panel.textContent.includes('Shared outcomes are counted once'));
  const cbo=rows.filter(r=>r.campaign.includes('Traffic_WA_EXP_CBO_NEW'));
  check('CBO campaign is loaded from Raw Data despite absent manual import tab',cbo.length>0&&panel.querySelector('.source-campaigns').textContent.includes('Traffic_WA_EXP_CBO_NEW'));
  check('All loaded campaigns are discoverable despite current filters',panel.querySelectorAll('.source-campaigns tbody tr').length===new Set(rows.map(r=>JSON.stringify([r.campaign,r.brand,r.account]))).size);
  const requested=performance.getEntriesByType('resource').map(r=>{try{return new URL(r.name).searchParams.get('sheet')}catch{return null}}).filter(Boolean);
  check('Browser requested Raw Data and supporting reports',requested.includes('Raw Data')&&requested.includes('Report Totals')&&requested.includes('Knowledge'));
  check('Browser never requests manual import tabs',!requested.some(t=>/^Import (SE|SLSA)/.test(t)));
  return {checks,rawRows:rows.length,cboRows:cbo.length,requestedTabs:[...new Set(requested)]};
 }finally{navigate(saved);}
})()
