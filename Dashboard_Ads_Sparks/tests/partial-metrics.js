(() => {
 const out=[],check=(name,ok)=>out.push({name,ok:!!ok});
 const make=(day,spend,leads,booking)=>A.normalize([{'Campaign name':'Traffic_WA_Main_ABO','Ad set name':'CL.JU_T_M_W','Ad name':'1/11/26 - I_TEST','Day':day,'Reporting starts':day,'Results':10,'Leads':leads,'Booking':booking,'Amount spent (IDR)':spend,'Result type':'Messaging conversations started','Account Group':'Main','Brand':'English','Ad delivery':'active'}])[0];
 const data=[make('2026-11-01',100000,10,2),make('2026-11-02',900000,null,null),make('2026-11-03',200000,20,null)],s=A.aggregate(data);
 check('Strict metrics remain unknown for decisions',s.cpl===null&&s.cpb===null&&s.bookingRate===null);
 check('Known lead count remains visible',metricDisplayData(s,'leads').value===30);
 check('Known booking count remains visible',metricDisplayData(s,'booking').value===2);
 check('Incomplete CPL is not presented as full-period cost',metricDisplayData(s,'cpl').value===null);
 check('Incomplete CPB is not presented as full-period cost',metricDisplayData(s,'cpb').value===null);
 check('Incomplete conversion is not presented as full-period ratio',metricDisplayData(s,'bookingRate').value===null);
 check('Coverage retains missing interior day',s.coverage.leads.rows===2&&s.coverage.leads.days===2&&s.coverage.leads.totalRows===3);
 const markup=meetingMetricStrip(displaySnapshot(s));check('Center card labels recorded counts and incomplete ratios',markup.includes('>30</span>')&&!markup.includes('Rp10.000')&&markup.includes('Recorded')&&markup.includes('Incomplete'));
 const zero=A.aggregate([make('2026-11-01',100000,0,0),data[1]]);check('Recorded zero is distinct from no data',metricDisplayData(zero,'leads').value===0&&metricDisplayData(A.aggregate([data[1]]),'leads').value===null);
 const full=A.aggregate([data[0]]);check('Complete data stays unchanged',metricDisplayData(full,'cpl').value===full.cpl&&!metricDisplayData(full,'cpl').partial);
 const screenshot=A.aggregate([{...data[0],results:3,leads:3,spend:99915},{...data[1],results:41,spend:868728}]);
 check('44 Results and incomplete 3 Leads never display misleading 100 percent',screenshot.results===44&&screenshot.leads===3&&screenshot.observed.leadRate===100&&metricDisplayData(screenshot,'leadRate').value===null&&!displayMetric(screenshot,'leadRate',percent).includes('100%'));
 check('Incomplete rate has no green or red target judgement',!displayMetric(screenshot,'leadRate',percent).includes('metric-target'));
 const complete44=A.aggregate([{...data[0],results:44,leads:3,spend:968643}]);
 check('Complete 44 Results and 3 Leads equals 6.82 percent',Math.abs(metricDisplayData(complete44,'leadRate').value-3/44*100)<1e-10);
 check('Complete CPL uses all selected spend',metricDisplayData(complete44,'cpl').value===322881);
 check('Empty center is not fabricated zero',metricDisplayData(A.aggregate([]),'leads').value===null);
 const snapshot=meetingSnapshot(s);check('Snapshot retains strict values and observed evidence',snapshot.metrics.cpl===null&&snapshot.observed.cpl===10000&&snapshot.coverage.leads.rows===2);
 const live=meetingCenterData().filter(g=>['CL.JU','CBN','TMP','BTR','GLK','BHI'].includes(g.center));
 check('Live centers with recorded leads display them',live.every(g=>g.leadRows===0||metricDisplayData(g,'leads').value===g.leads));
 check('Live centers retain coverage tooltip',live.filter(g=>g.leadRows>0&&g.leadRows<g.rows).every(g=>meetingMetricStrip(displaySnapshot(g)).includes('data-report-partial="true"')));
 return {checks:out,centers:live.map(g=>({center:g.center,leads:g.leads,booking:g.booking,leadRows:g.leadRows,rows:g.rows,cpl:metricDisplayData(g,'cpl').value,cpb:metricDisplayData(g,'cpb').value,through:g.coverage.leads.end}))};
})()
