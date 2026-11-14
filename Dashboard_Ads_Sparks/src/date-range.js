/* Today/Yesterday use Jakarta calendar dates; historical ranges follow the latest source date. */
let datePreset='last7';
const DATE_PRESETS={today:'Today',yesterday:'Yesterday',last3:'Last 3 days',last7:'Last 7 days',last14:'Last 14 days',last28:'Last 28 days',last30:'Last 30 days',lastWeek:'Last week',lastMonth:'Last month',lastMonthMtd:'Last month + MTD',mtd:'MTD',last4Weeks:'Last 4 W'};
function jakartaDay(now=new Date()){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=type=>p.find(x=>x.type===type).value;return `${part('year')}-${part('month')}-${part('day')}`;}
function latestSourceDay(){return rows.reduce((latest,r)=>r.day>latest?r.day:latest,'');}
function quickDateRange(preset,anchor,today=jakartaDay()){
  if(preset==='today'||preset==='yesterday'){
    const date=new Date(today+'T00:00:00Z');if(!Number.isFinite(+date))return null;
    if(preset==='yesterday')date.setUTCDate(date.getUTCDate()-1);
    const day=date.toISOString().slice(0,10);return {start:day,end:day};
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor))return null;
  const date=new Date(anchor+'T00:00:00Z');if(!Number.isFinite(+date))return null;
  const iso=d=>d.toISOString().slice(0,10),shift=(d,n)=>new Date(+d+n*86400000);
  const length={last3:3,last7:7,last14:14,last28:28,last30:30}[preset];
  if(length)return {start:iso(shift(date,1-length)),end:anchor};
  if(preset==='lastWeek'||preset==='last4Weeks'){
    const monday=shift(date,-((date.getUTCDay()+6)%7));
    return {start:iso(shift(monday,preset==='last4Weeks'?-28:-7)),end:iso(shift(monday,-1))};
  }
  if(preset==='lastMonth')return {start:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1))),end:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),0)))};
  if(preset==='mtd'||preset==='lastMonthMtd')return {start:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-(preset==='lastMonthMtd'?1:0),1))),end:anchor};
  return null;
}
function applyDatePreset(preset,refresh=true){
  const range=quickDateRange(preset,latestSourceDay());if(!range)return;
  datePreset=preset;rollingPeriod=true;page=0;explorerWeek='ALL';
  $('startFilter').value=range.start;$('endFilter').value=range.end;
  if(refresh)render();
}
function dateRangeText(){
  const format=day=>day?new Date(day+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Select date';
  const from=$('startFilter').value,to=$('endFilter').value;
  return from===to&&from?format(from):`${format(from)} – ${format(to)}`;
}
function updateDateRangeControl(){
  $('dateRangeText').textContent=dateRangeText();
  $('datePresetLabel').textContent=DATE_PRESETS[datePreset]||'Custom range';
  const anchor=latestSourceDay();
  $('dateRangeHint').textContent=`Today / Yesterday use Jakarta dates (today: ${jakartaDay()}). `+(anchor?`Other ranges end relative to latest data: ${anchor}. Last week: Monday–Sunday. Last month: full calendar month. MTD: month start through latest data. Last month + MTD: previous month start through latest data. Last 4 W: four completed Monday?Sunday weeks.`:'Other shortcuts are available after data loads.');
  document.querySelectorAll('[data-date-preset]').forEach(button=>{button.disabled=!anchor;button.classList.toggle('selected',button.dataset.datePreset===datePreset);button.setAttribute('aria-pressed',String(button.dataset.datePreset===datePreset));});
}
function setDateRangeOpen(open,restoreFocus=false){
  $('dateRangeMenu').hidden=!open;$('dateRangeToggle').setAttribute('aria-expanded',String(open));
  if(open)updateDateRangeControl();else if(restoreFocus)$('dateRangeToggle').focus();
}
$('dateRangeToggle').addEventListener('click',()=>setDateRangeOpen($('dateRangeMenu').hidden));
$('dateRangeDone').addEventListener('click',()=>setDateRangeOpen(false,true));
document.querySelectorAll('[data-date-preset]').forEach(button=>button.addEventListener('click',()=>{applyDatePreset(button.dataset.datePreset);setDateRangeOpen(false,true);}));
document.addEventListener('click',event=>{if(!$('dateRangeField').contains(event.target))setDateRangeOpen(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('dateRangeMenu').hidden){event.preventDefault();setDateRangeOpen(false,true);}});
$('dateRangeField').addEventListener('focusout',event=>{if(event.relatedTarget&&!$('dateRangeField').contains(event.relatedTarget))setDateRangeOpen(false);});
