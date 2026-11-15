(()=>{
 const checks=[],ok=(name,v)=>{checks.push({name,ok:!!v});console.debug("Scorecard QA",name);if(!v)throw Error(name);},near=(a,b)=>a===b||Math.abs(a-b)<1e-7;
 const filterIds=['startFilter','endFilter','centerFilter','accountFilter','campaignFilter','objectiveFilter','brandFilter','resultFilter','roleFilter','messageFilter','searchFilter'];
 const filters=()=>JSON.stringify(filterIds.map(id=>$(id).value));
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 navigate('overview');const before=filters();
 document.querySelector('[data-kpi="cpl"]').click();
 ok('Overview card opens matching scorecard pair',view==='scorecards'&&scorecardKeys.join(',')==='leads,cpl');
 ok('Overview navigation retains all filters',filters()===before);
 ok('Only two tables rendered',document.querySelectorAll('.sc-card').length===2);
 ok('All available date-range weeks are reachable',document.querySelector('[data-sc-page="older"]')&&!document.querySelector('[data-sc-page="older"]').disabled);
 document.querySelector('[data-sc-page="older"]').click();
 ok('Earlier-week paging works',scorecardOffset===1);
 document.querySelector('[data-sc-page="newer"]').click();
 document.querySelector('[data-sc-pair="booking"]').click();
 ok('Booking preset swaps both panels',scorecardKeys.join(',')==='booking,cpb'&&document.querySelector('[data-scorecard="cpb"]'));
 document.querySelector('[data-sc-pair="custom"]').click();
 ok('Custom provides nine main metrics',document.querySelectorAll('#scorecardMetric0 option').length===9);
 $('scorecardMetric0').value='spend';$('scorecardMetric0').dispatchEvent(new Event('change',{bubbles:true}));
 ok('Custom choice works',!!document.querySelector('[data-scorecard="spend"]'));
 $('scorecardMetric1').value='leadRate';$('scorecardMetric1').dispatchEvent(new Event('change',{bubbles:true}));
 ok('Custom conversion works',!!document.querySelector('[data-scorecard="leadRate"]'));
 // Reconcile the entire live selected range to the existing report aggregator.
 const weeks=MetricScorecards.build(selected,$('startFilter').value,$('endFilter').value,latestSourceDay());
 const aggregate=summaryAggregate(selected),totals=summaryAggregate(weeks.flatMap(w=>w.items));
 for(const key of ['spend','results','leads','booking','cpr','cpl','cpb','leadRate','bookingRate'])ok('Live range reconciliation '+key,near(aggregate[key],totals[key]));
 for(const w of weeks){
   const direct=summaryAggregate(selected.filter(r=>r.day>=w.start&&r.day<=w.end));
   for(const key of ['spend','results','leads','booking'])ok('Live weekly reconciliation '+w.start+' '+key,near(w.s[key],direct[key]));
 }
 ok('Source Week Num preserved on live data',weeks.every(w=>w.mappingIssue||w.items.every(r=>r.weekNum===w.number)));
 document.querySelector('[data-sc-range]').click();
 ok('4 week WTD shortcut selects four columns',MetricScorecards.build(selected,$('startFilter').value,$('endFilter').value,latestSourceDay()).length===4);
 ok('Shortcut ends at latest data', $('endFilter').value===latestSourceDay());
 const fourWeekDates=[$('startFilter').value,$('endFilter').value];
 $('centerFilter').value='CBN';$('centerFilter').dispatchEvent(new Event('change',{bubbles:true}));
 ok('Center filter narrows scorecard source',selected.length>0&&selected.every(r=>r.center==='CBN'));
 $('accountFilter').value='Main';$('accountFilter').dispatchEvent(new Event('change',{bubbles:true}));
 ok('Account filter remains active',selected.length>0&&selected.every(r=>r.account==='Main'));
 const sum=summaryAggregate(selected),cards=MetricScorecards.build(selected,...fourWeekDates,latestSourceDay());
 ok('Filtered spend reconciles',near(sum.spend,cards.reduce((n,w)=>n+w.s.spend,0)));
 $('centerFilter').value='ALL';$('accountFilter').value='ALL';render();
 navigate('overview');ok('Overview contains no scorecard tables',!document.querySelector('.sc-table'));
 document.querySelector('[data-kpi="cpb"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 ok('Keyboard activation opens CPB',view==='scorecards'&&scorecardKeys.includes('cpb'));
 document.querySelector('[data-sc-pair="leads"]').click();
 return {passed:checks.length,liveRows:selected.length,range:fourWeekDates,totals:{spend:aggregate.spend,results:aggregate.results,leads:aggregate.leads,booking:aggregate.booking},checks};
})()
