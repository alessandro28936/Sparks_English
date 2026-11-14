(() => {
 const out=[],check=(name,ok)=>out.push({name,ok:!!ok}),saved={rows,scope,view,chartGrain,explorerGrain,explorerLayout,meetingTab};
 const ids=['accountFilter','centerFilter','brandFilter','objectiveFilter','resultFilter','roleFilter','messageFilter','startFilter','endFilter','searchFilter'],filters=Object.fromEntries(ids.map(id=>[id,$(id).value]));
 const make=(account,day,spend,results,leads,booking,brand='English')=>A.normalize([{'Campaign name':'Traffic_WA_Main_ABO','Ad set name':'BHI_T_M_W','Ad name':'1/11/26 - I_TEST','Day':day,'Reporting starts':day,'Results':results,'Leads':leads,'Booking':booking,'Amount spent (IDR)':spend,'Result type':'Messaging conversations started','Account Group':account,'Brand':brand,'Ad delivery':'active','Week Num':45}])[0];
 try{
 rows=A.resolveTypes([make('Main','2026-11-01',100000,10,5,1),make('Secondary','2026-11-01',300000,20,12,3),make('Secondary','2026-11-02',50000,5,2,0),make('Secondary','2026-11-01',10000,1,1,0,'SLSA')]);scope='MY';
 for(const id of ['accountFilter','centerFilter','resultFilter','roleFilter','messageFilter'])$(id).value='ALL';$('brandFilter').value='English';$('objectiveFilter').value='Traffic';$('startFilter').value='2026-11-01';$('endFilter').value='2026-11-02';$('searchFilter').value='';updateOptions();navigate('overview');
 check('All Accounts is combined within brand',selected.length===3&&A.aggregate(selected).spend===450000);
 let g=accountComparisonData()[0];check('Combined CPR uses total spend and results',Math.abs(g.cpr-450000/35)<1e-8);
 check('Same names in different accounts remain separate ads',creatives.length===2);
 check('Account spend shares remain isolated',creatives.every(g=>g.share===100));
 check('Overview replaces comparison and trends with ad sets',!document.querySelector('.account-comparison,.account-trend')&&document.querySelectorAll('.adset-parent').length===2);
 check('Main and secondary center bars remain',document.querySelectorAll('[data-center-metric]').length===8);
 $('accountFilter').value='Secondary';render();check('Secondary filter applies to main metrics',selected.length===2&&A.aggregate(selected).spend===350000);
 check('History comparison respects account',trendHistoryRows().every(r=>r.account==='Secondary'));
 check('Filter keeps user date range',$('startFilter').value==='2026-11-01'&&$('endFilter').value==='2026-11-02');
 navigate('creatives');explorerGrain='summary';render();check('Explorer labels account',document.querySelector('#viewContent .account-secondary')!==null);
 explorerGrain='weekly';explorerLayout='compare';render();check('Weekly table labels account',document.querySelector('.comparison-matrix .account-secondary')!==null);
 rows=rows.map(r=>r.account==='Secondary'?{...r,spend:r.spend*10}:r);navigate('meeting');meetingTab='briefing';render();check('Meeting labels account',document.querySelector('.meeting-review-table .account-secondary')!==null);
 $('accountFilter').value='ALL';$('brandFilter').value='ALL';render();check('Comparison never pools brands',accountComparisonData().length===2);
 check('Missing outcome remains unknown',accountMetric(A.aggregate([make('Main','2026-11-01',10,1,null,null)]),'leads')===null);
 check('Account retained in meeting snapshot',meetingSnapshot(creatives.find(g=>g.account==='Secondary')).account==='Secondary');
 rows.push(make('Third','2026-11-01',70000,7,6,1));$('brandFilter').value='English';$('accountFilter').value='ALL';navigate('overview');
 check('Third is a separate account, never Unknown',accountName(rows.at(-1))==='Third'&&accountBadge('Third').includes('account-third'));
 check('Third adds a separate ad set with identical names',document.querySelectorAll('.adset-parent').length===3&&creatives.length===3);
 check('Third spend share uses its own account',creatives.find(g=>g.account==='Third')?.share===100);
 $('accountFilter').value='Third';render();
 check('Third filter excludes Main Secondary and SLSA',selected.length===1&&A.aggregate(selected).spend===70000);
 check('Third history is isolated',trendHistoryRows().every(r=>r.account==='Third'));
 check('Third snapshot preserves account',meetingSnapshot(creatives[0]).account==='Third');
 reset();check('Reset restores All Accounts',$('accountFilter').value==='ALL');
 }finally{rows=saved.rows;scope=saved.scope;view=saved.view;chartGrain=saved.chartGrain;explorerGrain=saved.explorerGrain;explorerLayout=saved.explorerLayout;meetingTab=saved.meetingTab;updateOptions();for(const id of ids)$(id).value=filters[id];render();}
 return out;
})()
