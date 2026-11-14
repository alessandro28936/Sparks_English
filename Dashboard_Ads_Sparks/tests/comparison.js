(() => {
  const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
  reset();explorerGrain='weekly';explorerLayout='compare';navigate('creatives');
  let model=comparisonData();
  check('Weekly comparison shows one entity per row',model.entities.length===new Set(model.entities.map(entityKey)).size);
  check('Weekly column headings omit dates',[...document.querySelectorAll('.comparison-matrix .period-cell')].every(e=>/^Week (\d+|belum diisi)$/.test(e.textContent)));
  check('All weeks preserve total spend',model.totals.reduce((s,g)=>s+g.spend,0)===A.aggregate(selected).spend);
  check('Metric cells have working detail',!!document.querySelector('.metric-value'));
  document.querySelector('.metric-value').click();check('Comparison opens detail',document.getElementById('detailDialog').open);document.getElementById('detailDialog').close();
  document.querySelector('[data-layout="rows"]').click();
  check('Period column contains only Week N',[...document.querySelectorAll('td.period-cell')].every(e=>/^Week (\d+|belum diisi)$/.test(e.textContent)));
  document.querySelector('[data-layout="compare"]').click();
  document.querySelector('[data-grain-kind="explorer"][data-grain="daily"]').click();
  model=comparisonData();
  check('Daily comparison has 1D 3D 7D 14D 30D',model.periods.map(p=>p.label).join(',')==='1D,3D,7D,14D,30D');
  check('Rolling windows do not exceed date filter',model.periods.every(p=>p.start>=$('startFilter').value&&p.end<=$('endFilter').value));
  check('Long windows marked partial for seven day filter',model.periods[3].partial&&model.periods[4].partial);
  for(let i=0;i<model.periods.length;i++){
    const p=model.periods[i],total=A.aggregate(selected.filter(p.contains));
    check(p.label+' totals independently reconcile',model.totals[i].spend===total.spend&&model.totals[i].leads===total.leads&&model.totals[i].cpl===total.cpl);
  }
  const exported=comparisonExportRows();check('Export includes rolling window labels',exported.some(g=>g.comparisonLabel==='30D')&&exported.every(g=>g.start>=$('startFilter').value));
  document.querySelector('[data-metrics="additional"]').click();check('Additional metrics comparison renders',document.querySelector('.comparison-matrix').textContent.includes('Frequency'));
  compareMetrics='main';explorerGrain='summary';explorerLayout='compare';reset();navigate('overview');
  return checks;
})()
