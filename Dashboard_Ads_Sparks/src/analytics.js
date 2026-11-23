/* Pure analytics: no network or DOM access. */
const Analytics = (() => {
  const MINE = ['BHI','BTR','TCT','BTY','TBT','TMP','GLK','CL.JU','CBN','MKS','BDS','SDJ'];
  const LABELS = {BHI:'Bekasi Harapan Indah',BTR:'Bintaro',TCT:'Tangerang City',BTY:'Bogor Taman Yasmin',TBT:'Tebet',TMP:'Taman Palem',GLK:'Green Lake','CL.JU':'Cluster Jakarta Utara',CBN:'Cibinong',BDS:'Dalam pembangunan',BSD:'BSD City'};
  const num = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v ?? '').trim().replace(/Rp\.?|\s|%/gi,'');
    if (!s || s.startsWith('#') || s === '-') return null;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
    else if (s.includes(',')) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g,'') : s.replace(',','.');
    const n = Number(s); return Number.isFinite(n) ? n : null;
  };
  const ratio = (a,b,m=1) => b>0 ? a/b*m : null;
  // Preserve the original Meta objective for filtering/export; compare the business outcome.
  const analysisObjective = r => ['Traffic','Leads'].includes(r.objective)&&/^(Messaging conversations started|Messages|Tidak tercatat)$/i.test(r.resultType||'')?'WhatsApp':r.objective;
  // A zero-result Traffic/Leads row still contributes spend to the user's WhatsApp outcome.
  // Raw type stays unknown for validation and individual-ad recommendations.
  const outcomeType = r => r.resultType==='Tidak tercatat'&&r.results===0&&['Traffic','Leads'].includes(r.objective)?'Messaging conversations started':r.resultType;
  const metricContext = r => JSON.stringify([r.brand,analysisObjective(r),outcomeType(r)]);
  const sameMetricContext = (a,b) => metricContext(a)===metricContext(b);
  // Keep historical name keys stable, but separate confirmed Ad IDs when names collide.
  const identitySuffix = r => {const id=r.adIdentityId||r.items?.[0]?.adIdentityId;return id?['Ad ID:'+id]:[];};
  const adIdentity = r => JSON.stringify([r.brand,r.account,r.campaign,r.adset,r.ad,...identitySuffix(r)]);
  function date(v) {
    const s = String(v ?? ''); let m;
    if ((m=s.match(/^Date\((\d+),(\d+),(\d+)/))) return `${m[1]}-${String(+m[2]+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    if ((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    return '';
  }
  const cleanMessage = v => { const s=String(v||'').trim(); return !s || s.startsWith('#') ? '' : s; };
  const trimAd = s => String(s||'').replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*/, '').trim();
  function weekNumber(value){const n=num(value);return Number.isInteger(n)&&n>=1&&n<=54?n:null;}
  const sheetWeekKey = r => `${r.day.slice(0,4)}|${r.weekNum??'UNKNOWN'}`;
  function sheetWeeks(rows){
    const map=new Map();
    for(const r of rows){
      if(!r.day)continue;
      const key=sheetWeekKey(r);
      if(!map.has(key))map.set(key,{key,weekNum:r.weekNum,weekYear:r.day.slice(0,4),start:r.day,end:r.day});
      const w=map.get(key);if(r.day<w.start)w.start=r.day;if(r.day>w.end)w.end=r.day;
    }
    return map;
  }
  function normalize(data) {
    const normalized=data.filter(r=>r['Ad set name']&&r['Ad name']&&r['Ad name']!=='Ad name').map(r=>{
      const adset=String(r['Ad set name']).trim(), tokens=adset.toUpperCase().replace(/^\[SLSA\]\s*/,'').split('_').filter(t=>t!=='SLSA'), code=tokens[0].startsWith('ALLS-ENG-')?({'JU':'CL.JU'}[tokens[0].slice(9)]||tokens[0].slice(9)):tokens[0];
      const day=date(r['Reporting starts'])||date(r.Day), ad=String(r['Ad name']).trim(), adCode=String(r['Ad Trim']||trimAd(ad)).trim();
      const rawMessage=cleanMessage(r['Key Message Content']);
      const objective={T:'Traffic',L:'Leads',S:'Sales'}[tokens[1]]||'Tidak diketahui';
      const role={M:'Main',E:'Experiment',D:'Diversified'}[tokens[2]]||'Lainnya';
      const type=String(r['Result type']||'').trim();
      const explicitVideo=/^V/i.test(adCode), explicitImage=/^I/i.test(adCode);
      return {raw:r,account:String(r['Account Group']||r['Account ID']||''),importSource:String(r['Import Source']||''),day,weekNum:weekNumber(r['Week Num']),center:code,sourceCenter:code,adset,ad,adCode,campaign:String(r['Campaign name']||''),objective,role,brand:String(r.Brand||'').toUpperCase()==='SLSA'?'SLSA':/(?:^|[^A-Z0-9])SLSA(?:$|[^A-Z0-9])/i.test(adset+' '+r['Campaign name'])?'SLSA':'English',
        resultType:type||'Tidak tercatat',pillar:cleanMessage(r['Content Pillar']),message:rawMessage,messageSource:rawMessage?'Raw Data':'Belum dipetakan',
        format:explicitVideo?'Video':explicitImage?'Image':'Tidak diketahui',status:String(r['Ad delivery']||r['Delivery status']||'').toLowerCase(),
        spend:num(r['Amount spent (IDR)'])||0,results:num(r.Results)||0,leads:num(r.Leads),booking:num(r.Booking),impressions:num(r.Impressions)||0,clicks:num(r['Link clicks'])||0,views:num(r.Views)||0,plays3:num(r['3-second video plays'])||0,plays100:num(r['Video plays at 100%'])||0,frequency:num(r.Frequency)};
    });
    const ids=new Map();
    for(const r of normalized){const key=adIdentity(r),id=String(r.raw['Ad ID']||'').trim();if(!ids.has(key))ids.set(key,new Set());if(id)ids.get(key).add(id);}
    for(const r of normalized){if(ids.get(adIdentity(r)).size>1)r.adIdentityId=String(r.raw['Ad ID']||'').trim()||'Unknown';}
    return normalized;
  }
  function aggregate(rows) {
    const reportIssues={leads:{missing:0,ambiguous:0,unmatched:0},booking:{missing:0,ambiguous:0,unmatched:0}};
    const covered={leads:{rows:0,spend:0,results:0,total:0,days:new Set()},booking:{rows:0,spend:0,total:0,days:new Set()},pair:{rows:0,spend:0,leads:0,booking:0,days:new Set()}};
    const s={spend:0,results:0,leads:0,booking:0,impressions:0,clicks:0,views:0,plays3:0,plays100:0,videoImpressions:0,videoViews:0,frequencyBase:0,frequencyWeight:0,leadRows:0,bookingRows:0,days:new Set(),types:new Set(),objectives:new Set(),brands:new Set()};
    rows.forEach(r=>{
      for(const k of ['leads','booking'])if(!Number.isFinite(r[k]))reportIssues[k][r.reportIssue?.[k]||'missing']++;
      for(const k of ['spend','results','impressions','clicks','views']) s[k]+=r[k];
      if(Number.isFinite(r.leads)) {s.leads+=r.leads;s.leadRows++;const c=covered.leads;c.rows++;c.spend+=r.spend;c.results+=r.results;c.total+=r.leads;if(r.day)c.days.add(r.day);}
      if(Number.isFinite(r.booking)) {s.booking+=r.booking;s.bookingRows++;const c=covered.booking;c.rows++;c.spend+=r.spend;c.total+=r.booking;if(r.day)c.days.add(r.day);}
      if(Number.isFinite(r.leads)&&Number.isFinite(r.booking)){const c=covered.pair;c.rows++;c.spend+=r.spend;c.leads+=r.leads;c.booking+=r.booking;if(r.day)c.days.add(r.day);}
      if(r.format==='Video') {s.plays3+=r.plays3;s.plays100+=r.plays100;s.videoImpressions+=r.impressions;s.videoViews+=r.views;}
      if(r.frequency>0&&r.impressions>0){s.frequencyBase+=r.frequency*r.impressions;s.frequencyWeight+=r.impressions;}
      if(r.day)s.days.add(r.day); if(r.results>0)s.types.add(r.resultType); s.objectives.add(r.objective);s.brands.add(r.brand);
    });
    const mixed=s.types.size>1||new Set(rows.map(analysisObjective)).size>1||s.brands.size>1||s.types.has('Tidak tercatat');
    const metadata=c=>{const days=[...c.days].sort();return {rows:c.rows,totalRows:rows.length,days:days.length,start:days[0]||'',end:days.at(-1)||'',spend:c.spend,results:c.results??null,leads:c.leads??null,booking:c.booking??null};};
    const coverage={leads:metadata(covered.leads),booking:metadata(covered.booking),cpl:metadata(covered.leads),cpb:metadata(covered.booking),leadRate:metadata(covered.leads),bookingRate:metadata(covered.pair)};
    const observed={leads:s.leadRows?s.leads:null,booking:s.bookingRows?s.booking:null,cpl:ratio(covered.leads.spend,s.leads),cpb:ratio(covered.booking.spend,s.booking),leadRate:!mixed?ratio(s.leads,covered.leads.results,100):null,bookingRate:ratio(covered.pair.booking,covered.pair.leads,100)};
    return {...s,rows:rows.length,mixed,coverage,observed,reportIssues,cpr:!mixed?ratio(s.spend,s.results):null,cpl:s.leadRows===rows.length?ratio(s.spend,s.leads):null,cpb:s.bookingRows===rows.length?ratio(s.spend,s.booking):null,ctr:ratio(s.clicks,s.impressions,100),hook:ratio(s.plays3,s.videoImpressions,100),view:ratio(s.plays100,s.videoViews,100),frequency:ratio(s.frequencyBase,s.frequencyWeight),leadRate:!mixed&&s.leadRows===rows.length?ratio(s.leads,s.results,100):null,bookingRate:s.leadRows===rows.length&&s.bookingRows===rows.length?ratio(s.booking,s.leads,100):null,avgResults:ratio(s.results,s.days.size),avgLeads:s.leadRows===rows.length?ratio(s.leads,s.days.size):null};
  }
  function group(rows,keyFn) {
    const m=new Map(); for(const r of rows){const k=keyFn(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
    return [...m].map(([key,items])=>({key,items,...aggregate(items)}));
  }
  const iso = d => d.toISOString().slice(0,10);
  function period(day, grain='daily') {
    const start=new Date(day+'T00:00:00Z'),end=new Date(start);
    if(grain==='weekly') {
      start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
      end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+6);
    }else if(grain==='monthly') {
      start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0);
    }
    return {start:iso(start),end:iso(end)};
  }
  function periodGroups(rows,grain='daily',from='',to='') {
    const dated=rows.filter(r=>r.day&&(!from||r.day>=from)&&(!to||r.day<=to));
    const dates=dated.map(r=>r.day).sort();from=from||dates[0];to=to||dates.at(-1);
    if(!from||!to||from>to)return [];
    const grouped=new Map();for(const r of dated){const key=period(r.day,grain).start;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
    const result=[];let cursor=from;
    while(cursor<=to){
      const p=period(cursor,grain),items=grouped.get(p.start)||[],start=p.start<from?from:p.start,end=p.end>to?to:p.end;
      result.push({...aggregate(items),items,key:p.start,start,end,partial:start!==p.start||end!==p.end});
      const next=new Date(p.end+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);cursor=iso(next);
    }
    return result;
  }
  // Empty result type on zero-result days belongs to its ad entity only if unambiguous.
  function resolveTypes(rows) {
    const sets=new Map(); const key=adIdentity;
    rows.forEach(r=>{if(r.resultType!=='Tidak tercatat'){if(!sets.has(key(r)))sets.set(key(r),new Set());sets.get(key(r)).add(r.resultType);}});
    return rows.map(r=>{const t=sets.get(key(r));return r.resultType==='Tidak tercatat'&&r.results===0&&t?.size===1?{...r,resultType:[...t][0]}:r;});
  }
  function state(s,config) {
    if(!s.rows||!s.spend)return 'EMPTY';
    if(s.mixed||s.items?.some(r=>r.resultType==='Tidak tercatat'))return 'MIXED';
    if(s.spend<config.minSpend)return 'SAMPLE';
    if(!s.results)return 'CRITICAL';
    if(s.cpr>config.target*1.25)return 'CRITICAL';
    if(s.cpr>config.target)return 'CRITICAL';
    if(s.results<config.minResults)return 'SAMPLE';
    return 'MONITOR';
  }
  function diagnose(s,base,config) {
    const st=state(s,config), reasons=[], actions=[];
    if(st==='EMPTY')return {reasons:['Belum ada delivery dalam filter ini.'],actions:['Tunggu data delivery.']};
    if(st==='MIXED')return {reasons:['Objective atau jenis Results belum sebanding / belum diketahui.'],actions:['Pilih objective dan jenis Results, atau lengkapi Result type sebelum menilai CPR.']};
    if(st==='SAMPLE')return {reasons:[`Sampel belum cukup: minimum spend ${config.minSpend.toLocaleString('id-ID')} dan ${config.minResults} Results untuk kandidat iterate.`],actions:['Lanjutkan pengumpulan data; jangan menyimpulkan winner dari sampel kecil.']};
    if(!s.results)reasons.push('Sudah melewati minimum spend tanpa Results.');
    else reasons.push(st==='MONITOR'?'CPR memenuhi target dan ambang sampel.':'CPR melampaui target pada periode terpilih.');
    if(base?.rows) {
      if(s.hook!==null&&base.hook>0&&s.hook<base.hook*.75){reasons.push('Hook rate <75% benchmark video sebanding.');actions.push('Uji 3 detik pembuka: tampilkan masalah orang tua atau outcome anak lebih awal.');}
      if(s.view!==null&&base.view>0&&s.view<base.view*.75){reasons.push('Views rate <75% benchmark video sebanding.');actions.push('Uji durasi lebih singkat dan letakkan bukti manfaat sebelum bagian yang kehilangan perhatian.');}
      if(s.ctr!==null&&base.ctr>0&&s.ctr<base.ctr*.75){reasons.push('CTR <75% benchmark format yang sama.');actions.push('Uji visual pembuka, headline dan relevansi pesan terhadap audience center.');}
      if(s.leadRate!==null&&base.leadRate>0&&s.leadRate<base.leadRate*.75){reasons.push('Results → Leads <75% benchmark.');actions.push('Periksa kesesuaian janji iklan, CTA, dan alur chat bersama tim sales.');}
    }
    if(st==='ITERATE')actions.unshift('Re-create konsep dengan satu perubahan hook/visual; bandingkan pada center dan objective yang sama.');
    if(!actions.length)actions.push('Periksa offer, CTA, audience, delivery dan alur tindak lanjut. Metrik saja belum membuktikan penyebab creative.');
    if(s.leadRate>100)reasons.push('Results → Leads >100%; periksa perbedaan atribusi/tanggal, bukan conversion rate funnel murni.');
    return {reasons,actions};
  }
  return {MINE,LABELS,num,date,ratio,analysisObjective,outcomeType,metricContext,sameMetricContext,identitySuffix,adIdentity,normalize,aggregate,group,period,periodGroups,weekNumber,sheetWeekKey,sheetWeeks,resolveTypes,state,diagnose};
})();
