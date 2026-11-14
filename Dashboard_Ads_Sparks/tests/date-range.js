(async () => {
 const checks=[],check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw new Error(name);};
 const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 const eq=(key,anchor,start,end)=>JSON.stringify(quickDateRange(key,anchor))===JSON.stringify({start,end});
 check('Last 3 days includes latest data day',eq('last3','2026-11-04','2026-11-02','2026-11-04'));
 check('Last 7 days crosses month boundary',eq('last7','2026-11-04','2026-10-29','2026-11-04'));
 check('Last week is the previous complete Monday-Sunday',eq('lastWeek','2026-11-04','2026-10-26','2026-11-01'));
 check('Sunday does not select the unfinished current week',eq('lastWeek','2026-11-01','2026-10-19','2026-10-25'));
 check('Monday selects the week that just ended',eq('lastWeek','2026-11-02','2026-10-26','2026-11-01'));
 check('Last month selects the complete calendar month',eq('lastMonth','2026-11-04','2026-10-01','2026-10-31'));
 check('Leap February has 29 days',eq('lastMonth','2024-03-01','2024-02-01','2024-02-29'));
 check('January selects December of previous year',eq('lastMonth','2027-01-05','2026-12-01','2026-12-31'));
 check('Rolling days cross the year boundary',eq('last3','2027-01-02','2026-12-31','2027-01-02'));
 check('Missing anchor leaves range unavailable',quickDateRange('last7','')===null);
 check('Last 14 days is inclusive',eq('last14','2026-11-04','2026-10-22','2026-11-04'));
 check('Last 28 days is inclusive',eq('last28','2026-11-04','2026-10-08','2026-11-04'));
 check('Last 30 days is inclusive',eq('last30','2026-11-04','2026-10-06','2026-11-04'));
 check('Today uses calendar day even when source is older',quickDateRange('today','2026-11-01','2026-11-05').start==='2026-11-05');
 check('Yesterday crosses year boundary',quickDateRange('yesterday','2026-12-28','2027-01-01').start==='2026-12-31');
 check('Jakarta day changes at 17:00 UTC',jakartaDay(new Date('2026-11-04T17:00:00Z'))==='2026-11-05'&&jakartaDay(new Date('2026-11-04T16:59:59Z'))==='2026-11-04');
 check('MTD starts at the source month',eq('mtd','2026-11-13','2026-11-01','2026-11-13'));
 check('Last month plus MTD includes the whole previous month',eq('lastMonthMtd','2026-11-13','2026-10-01','2026-11-13'));
 check('MTD on first day is a single day',eq('mtd','2027-01-01','2027-01-01','2027-01-01'));
 check('Combined range crosses year correctly',eq('lastMonthMtd','2027-01-05','2026-12-01','2027-01-05'));
 check('Last 4 W is four completed calendar weeks',eq('last4Weeks','2026-11-13','2026-10-12','2026-11-08'));
 check('Last 4 W handles Monday year boundary',eq('last4Weeks','2027-01-04','2026-12-07','2027-01-03'));
 const saved={datePreset,rollingPeriod,view,page,explorerWeek,start:$('startFilter').value,end:$('endFilter').value,center:$('centerFilter').value};
 try{
  navigate('overview');$('centerFilter').value='BHI';render();
  $('dateRangeToggle').click();check('Date control opens twelve shortcuts',!$('dateRangeMenu').hidden&&document.querySelectorAll('[data-date-preset]').length===12);
  for(const key of Object.keys(DATE_PRESETS)){
   if($('dateRangeMenu').hidden)$('dateRangeToggle').click();
   document.querySelector(`[data-date-preset="${key}"]`).click();const expected=quickDateRange(key,latestSourceDay());
   check(key+' updates both dates and closes menu',$('startFilter').value===expected.start&&$('endFilter').value===expected.end&&$('dateRangeMenu').hidden&&datePreset===key&&rollingPeriod);
   check(key+' preserves center and filters data',$('centerFilter').value==='BHI'&&selected.every(r=>r.center==='BHI'&&r.day>=expected.start&&r.day<=expected.end));
  }
  $('dateRangeToggle').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check('Escape closes and restores trigger focus',$('dateRangeMenu').hidden&&document.activeElement===$('dateRangeToggle'));
  $('dateRangeToggle').click();$('pageTitle').click();check('Click outside dismisses menu',$('dateRangeMenu').hidden);
  $('dateRangeToggle').click();$('startFilter').value='2026-10-05';$('startFilter').dispatchEvent(new Event('change',{bubbles:true}));$('endFilter').value='2026-10-12';$('endFilter').dispatchEvent(new Event('change',{bubbles:true}));
  check('Manual dates become custom and stop rolling',datePreset==='custom'&&!rollingPeriod&&$('datePresetLabel').textContent==='Custom range'&&$('startFilter').value==='2026-10-05'&&$('endFilter').value==='2026-10-12');
  $('dateRangeDone').click();check('Done keeps manual dates',$('dateRangeMenu').hidden&&$('endFilter').value==='2026-10-12');
  const original=jsonp,savedRaw=raw,savedKnowledge=knowledge;
  try{
   const latest=[...rows].sort((a,b)=>b.day.localeCompare(a.day))[0],next=shift(latest.day,1);
   jsonp=tab=>Promise.resolve(tab==='Raw Data'?[...savedRaw,{...latest.raw,'Reporting starts':next}]:savedKnowledge);
   await sync();check('Sync preserves custom dates',$('startFilter').value==='2026-10-05'&&$('endFilter').value==='2026-10-12');
   applyDatePreset('last3');
   jsonp=tab=>Promise.resolve(tab==='Raw Data'?[...savedRaw,{...latest.raw,'Reporting starts':shift(next,1)}]:savedKnowledge);
   await sync();check('Sync advances the selected shortcut instead of reverting to seven days',datePreset==='last3'&&$('endFilter').value===shift(next,1)&&$('startFilter').value===shift(next,-1));
  }finally{jsonp=tab=>Promise.resolve(tab==='Raw Data'?savedRaw:savedKnowledge);await sync();jsonp=original;}
  reset();check('Reset restores Last 7 days',datePreset==='last7'&&rollingPeriod&&$('startFilter').value===quickDateRange('last7',latestSourceDay()).start);
 }finally{datePreset=saved.datePreset;rollingPeriod=saved.rollingPeriod;view=saved.view;page=saved.page;explorerWeek=saved.explorerWeek;$('centerFilter').value=saved.center;$('startFilter').value=saved.start;$('endFilter').value=saved.end;setDateRangeOpen(false);render();}
 return checks;
})()
