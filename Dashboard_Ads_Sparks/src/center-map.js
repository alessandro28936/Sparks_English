/* Schematic geography from user-supplied addresses. Never infer branch-level outcomes. */
const CENTER_LOCATIONS=[
 {code:'CL.JU',name:'North Jakarta',region:'metro',codes:['CL.JU','KGD','STR','PLM'],sites:[['Kelapa Gading','Jl. Boulevard Timur No.30–34, Pegangsaan Dua, Jakarta Utara 14250'],['Sunter','Jl. Danau Sunter Utara No.F.20 29, Sunter Agung, Jakarta Utara 14350'],['Pulomas','All Fresh Avenue Blok D3, Jl. Kayu Putih Raya No.1, Jakarta Timur']],shared:true},
 {code:'TJD',name:'Tanjung Duren',region:'metro',sites:[['Tanjung Duren','Jl. Tanjung Duren Raya No.356–357, Jakarta Barat 11470']]},
 {code:'TMP',name:'Taman Palem',region:'metro',sites:[['Taman Palem','Citra 3 Extension Blok F2 C1–C8, C50–C52, Jl. Palem Raja Barat, Pegadungan, Jakarta Barat 11830']]},
 {code:'KLM',name:'Kalimalang',region:'metro',sites:[['Kalimalang','Ruko Kalimalang Mas Blok E7 B1–B2, Jl. Kalimalang Raya, Pondok Bambu, Jakarta Timur 13430']]},
 {code:'PJT',name:'Pejaten',region:'metro',sites:[['Pejaten','Jl. Pejaten Raya No.33, Jati Padang, Pasar Minggu, Jakarta Selatan 12540']]},
 {code:'TBT',name:'Tebet',region:'metro',sites:[['Tebet','Jl. Tebet Barat Dalam No.39, Jakarta Selatan 12810']]},
 {code:'KMG',name:'Kemang',region:'metro',sites:[['Kemang','Jl. Ampera Raya No.37, Cilandak Timur, Pasar Minggu, Jakarta Selatan']]},
 {code:'BGR',name:'Pajajaran',region:'metro',sites:[['Pajajaran','Jl. Raya Pajajaran No.10, Babakan, Bogor Tengah 16128']]},
 {code:'BTY',name:'Taman Yasmin',region:'metro',sites:[['Taman Yasmin','Ruko Permata Yasmin No.14, Cilendek, Bogor Barat 16112']]},
 {code:'CBN',name:'Cibinong',region:'metro',sites:[['Cibinong','Jl. Tegar Beriman No.44, Tengah, Cibinong, Kabupaten Bogor 16914']]},
 {code:'DPK',name:'Depok',region:'metro',shared:true,sites:[['Margonda','Jl. Margonda No.283, Kemiri Muka, Beji, Depok 16423'],['Siliwangi','Graha Semesta, Jl. Sersan Anning No.74A, Pancoran Mas, Depok 16431']]},
 {code:'BSD',name:'BSD',region:'metro',sites:[['BSD','Ruko Pasar Modern Timur No.15–16A, Jl. Letnan Sutopo, Serpong, Tangerang Selatan 15310']]},
 {code:'TCT',name:'TangCity',region:'metro',sites:[['TangCity','Ruko Citypark Blok G No.17, Jl. Perintis Kemerdekaan, Tangerang 15118']]},
 {code:'GLK',name:'Greenlake',region:'metro',sites:[['Greenlake','Ruko Korean Town No.38, 50, 52, 56, 58, 60, 62 & 66, Jl. Greenlake City Boulevard, Cipondoh, Tangerang 15147']]},
 {code:'BTR',name:'Bintaro',region:'metro',sites:[['Bintaro','Jl. Jend. Sudirman, Pondok Jaya, Pondok Aren, Tangerang Selatan 15229']]},
 {code:'BKP',name:'Kemang Pratama',region:'metro',sites:[['Kemang Pratama','Jl. Kemang Pratama Raya No.B9, Bojong Rawalumbu, Bekasi 17116']]},
 {code:'BHI',name:'Harapan Indah',region:'metro',sites:[['Harapan Indah','Mega Office Park Blok OP 3 No.9, Jl. Harapan Indah Boulevard, Medan Satria, Bekasi 17132']]},
 {code:'CKR',name:'Cikarang',region:'metro',sites:[['Cikarang','Jl. Sriwijaya No.16, Cibatu, Cikarang Selatan 17530']]},
 {code:'BDG',name:'Bandung',region:'bandung',sites:[['Bandung','Jl. LLRE Martadinata No.227, Merdeka, Sumurbandung, Bandung 40113']]},
 {code:'YOG',name:'Yogyakarta',region:'yogya',sites:[['Yogyakarta','Jl. Colombo No.83, Karang Malang, Caturtunggal, Depok, Sleman, DIY 55281']]},
 {code:'SGB',name:'Gubeng',region:'surabaya',sites:[['Gubeng','Jl. Sulawesi No.39, Gubeng, Surabaya 60281']]},
 {code:'SKL',name:'Klampis',region:'surabaya',sites:[['Klampis','Jl. Klampis Jaya No.3E–3G, Klampis Ngasem, Sukolilo, Surabaya 60117']]},
 {code:'MKS',name:'Makassar',region:'makassar',sites:[],locationNote:'Makassar city area. Branch address has not been confirmed.'},
 {code:'BLI',name:'Kuta',region:'bali',sites:[['Kuta','Jl. Sunset Road No.169A, Kuta, Badung, Bali 80361']]}
];
const MAP_REGIONS={metro:{name:'Jabodetabek',point:[106.82,-6.22],island:'java'},bandung:{name:'Bandung',point:[107.61,-6.91],island:'java'},yogya:{name:'Yogyakarta',point:[110.37,-7.79],island:'java'},surabaya:{name:'Surabaya',point:[112.74,-7.27],island:'java'},bali:{name:'Bali - Kuta',point:[115.17,-8.72],island:'bali'},makassar:{name:'Makassar - MKS',point:[119.43,-5.15],island:'sulawesi'}};
let mapRegion='islands',mapZoom=1,mapFocus=null,mapTab='summary',mapPair='leads',mapWeekPage=0,mapAdDetails=[],mapModels=[],mapPreviewId=null;
let mapTableState={delivery:'active',metric:'cpr',order:'best',expanded:new Set()};
const MapPerformance=(()=>{
 function classify(s,items,thresholds={cpr:config.target,cpl:config.cplTarget,cpb:300000}){
  if(!items.length)return {tone:'unknown',label:'No data in selection',reason:'No matching rows. This does not mean the center is inactive.'};
  const latest=new Map();for(const r of items){const id=Rules.identity(r),p=latest.get(id);if(!p||r.day>p.day)latest.set(id,{day:r.day,states:new Set([r.status])});else if(r.day===p.day)p.states.add(r.status);}
  const states=[...latest.values()].map(v=>v.states.size===1?[...v.states][0]:'unknown');
  if(states.every(s=>s==='inactive'))return {tone:'off',label:'Ads inactive',reason:'All ads have inactive as their latest recorded status in this period.'};
  if(!states.includes('active'))return {tone:'unknown',label:'Delivery unverified',reason:'Latest delivery status is unknown or conflicting.'};
  if(s.spend<config.minSpend)return {tone:'unknown',label:'Learning',reason:'Spend below '+money(config.minSpend)+'.'};
  const values={};for(const k of ['cpr','cpl','cpb','leadRate']){const r=MetricScorecards.read(s,k);if(r.partial)return {tone:'unknown',label:'Check data',reason:'Outcome reports are incomplete.'};values[k]=r.value;}
  if(s.mixed)return {tone:'unknown',label:'Mixed contexts',reason:'Choose a single brand and Results context.'};
  if(!thresholds||Object.values(thresholds).some(v=>!Number.isFinite(v)||v<=0))return {tone:'unknown',label:'Target not set',reason:'Set brand targets before judging performance.'};
  if(s.results===0)return {tone:'bad',label:'Needs attention',reason:'Spend recorded with 0 Results.'};
  if(s.results<config.minResults)return {tone:'unknown',label:'Learning',reason:'Fewer than '+config.minResults+' Results.'};
  if(s.leads===0&&s.leadRows===s.rows||s.booking===0&&s.bookingRows===s.rows&&s.spend>=thresholds.cpb)return {tone:'bad',label:'Needs attention',reason:'No Leads or Booking after sufficient spend.'};
  if(values.cpr>thresholds.cpr*1.2||values.cpl>thresholds.cpl*1.2||values.cpb>thresholds.cpb*4/3||values.leadRate!==null&&values.leadRate<60)return {tone:'bad',label:'Needs attention',reason:'Cost exceeds the review boundary or Results → Leads is below 60%.'};
  if(values.cpr>=thresholds.cpr*.9||values.cpl>=thresholds.cpl*.9||values.cpb>=thresholds.cpb*.9||values.leadRate!==null&&values.leadRate<80)return {tone:'watch',label:'Watch closely',reason:'Costs approach/exceed target or Results → Leads is below 80%.'};
  if(Object.values(values).some(v=>v===null))return {tone:'unknown',label:'Learning',reason:'Not enough outcomes to assess all main metrics.'};
  return {tone:'good',label:'On track',reason:'Costs below 90% of target and Results → Leads at least 80%.'};
 }
 return {classify};
})();
function mapCatalog(){
 const known=new Set(CENTER_LOCATIONS.flatMap(l=>l.codes||[l.code]));
 const extra=[...new Set([...rows.map(r=>r.center),...A.MINE])].filter(c=>!known.has(c));
 return [...CENTER_LOCATIONS,...extra.map(code=>({code,name:labels[code]||code,region:code==='C.SBY'?'surabaya':'unmapped',sites:[],construction:code==='BDS'}))];
}
function mapLocationVisible(loc,items){
 const codes=loc.codes||[loc.code],chosen=$('centerFilter').value;
 if(chosen!=='ALL'&&!codes.includes(chosen))return false;
 const preheat=codes.includes('C.IN');
 if(workView==='preheat'&&!preheat||workView==='centers'&&preheat)return false;
 if(scope==='MY'&&!preheat&&!codes.some(c=>A.MINE.includes(c)))return false;
 // Selected rows already enforce brand, ownership (including Third), dates and every filter.
 // Keep assigned sites with no data only in the broad center view; never leak other accounts.
 const narrowed=['accountFilter','campaignFilter','roleFilter','messageFilter'].some(id=>$(id).value!=='ALL')||$('searchFilter').value.trim();
 if(narrowed||preheat)return items.length>0;
 return true;
}
function buildMapModels(){
 const brands=$('brandFilter').value==='ALL'?['English','SLSA']:[$('brandFilter').value];
 return mapCatalog().flatMap(loc=>brands.map(brand=>{
  const codes=loc.codes||[loc.code],items=selected.filter(r=>r.brand===brand&&codes.includes(r.center));if(!mapLocationVisible(loc,items))return null;const s=summaryAggregate(items);
  let thresholds={cpr:config.target,cpl:config.cplTarget,cpb:300000};
  if(brand==='SLSA'){const scope=JSON.parse(ScorecardTargets.scopeKey());scope[2]=loc.code;const days=[...s.days];thresholds=Object.fromEntries(['cpr','cpl','cpb'].map(k=>[k,ScorecardTargets.target(days,k,brand,JSON.stringify(scope))]));}
  const state=loc.construction&&!items.length?{tone:'off',label:'Under construction',reason:'BDS is distinct from BSD; its location is not yet mapped.'}:MapPerformance.classify(s,items,thresholds);
  const alerts=priorityData.sets.filter(a=>codes.includes(a.center)&&a.items[0]?.brand===brand);
  return {...loc,codes,brand,id:brand+'|'+loc.code,items,s,...state,alerts};
 })).filter(Boolean);
}
function mapBuilding(x,y,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})" class="map-building"><ellipse cx="0" cy="18" rx="29" ry="10" fill="#193e3630"/><path d="M-24-17L0-30 24-17 0-4Z" fill="#f5ecd0"/><path d="M-24-17L0-4V25L-24 11Z" fill="#faf9e9"/><path d="M0-4L24-17V11L0 25Z" fill="#bec8ae"/><path d="M-27-22L0-38 27-22 0-7Z" fill="#e5eea0" stroke="#617d67"/><path d="M-27-22L0-7V-1L-27-16Z" fill="#b2c77b"/><path d="M0-7L27-22V-16L0-1Z" fill="#8ea768"/><path d="M-18-9L-10-5V4L-18 0ZM-7-3L-2 0V9L-7 6Z" fill="#81b8c0"/><path d="M8 3L16-2V16L8 20Z" fill="#426e61"/><path d="M-22 7L-2 18V24L-22 13Z" fill="currentColor"/></g>`;}
function mapBadge(m,position=''){return `<button style="${position}" class="map-center-badge ${position?'geo-center-pin':''} tone-${m.tone}" data-map-center="${esc(m.id)}" aria-label="${esc(m.name+' · '+m.brand+' · '+m.label)}" aria-haspopup="dialog"><span class="map-block" aria-hidden="true"><svg viewBox="0 0 60 70">${mapBuilding(30,42,.7)}</svg></span><span class="map-badge-text"><strong>${esc(m.code)}</strong><small>${esc(m.name)}</small>${$('brandFilter').value==='ALL'?`<small>${m.brand==='English'?'English':'SLSA'}</small>`:''}</span><span class="map-signal" aria-hidden="true"></span>${m.alerts.length?`<b class="map-alert-count" title="Ad set alerts · last 7 days">! ${m.alerts.length}</b>`:''}</button>`;}
function geographicCenterScene(models){
 const placed=MapGeography.layout(models.filter(m=>MAP_ANCHORS[m.code]).map(m=>({...m,anchor:MapGeography.project(MAP_ANCHORS[m.code])})));
 return MapGeography.metroTerrain()+MapGeography.connectors(placed,'metro')+placed.map(m=>mapBadge(m,`left:${m.x/11}%;top:${m.y/7.6}%;width:${m.w/11}%;height:${m.h/7.6}%;`)).join('');
}
function geographicIslandsScene(mapped,regions){
 const islands=[...new Set(regions.map(([,r])=>r.island))];
 const entries=regions.map(([id,r])=>{const ms=mapped.filter(m=>m.region===id);return {id,...r,ms,alerts:ms.reduce((n,m)=>n+m.alerts.length,0),tone:['bad','watch','good','unknown','off'].find(t=>ms.some(m=>m.tone===t)),anchor:MapGeography.project(r.point,'islands')};});
 const placed=MapGeography.layout(entries,'islands');
 return MapGeography.islandsTerrain(islands)+MapGeography.connectors(placed,'islands')+placed.map(r=>`<button class="geo-region-pin tone-${r.tone}" style="left:${r.x/11}%;top:${r.y/5.8}%;width:${r.w/11}%;height:${r.h/5.8}%;" ${r.id==='makassar'&&r.ms.length===1?`data-map-center="${esc(r.ms[0].id)}"`:`data-map-region="${r.id}"`} aria-label="Explore ${esc(r.name)}"><span class="geo-building" aria-hidden="true"><svg viewBox="0 0 60 70">${mapBuilding(30,42,.7)}</svg></span><span><strong>${esc(r.name)}</strong><small>${r.ms.length} ${r.ms.length===1?'center':'centers'}${r.alerts?' / '+r.alerts+' alerts':''}</small></span></button>`).join('');
}
function renderCenterMap(recompute=true){
 if(recompute)mapModels=buildMapModels();const mapped=mapModels.filter(m=>m.region!=='unmapped'),unmapped=mapModels.filter(m=>m.region==='unmapped');
 const regions=Object.entries(MAP_REGIONS).filter(([id])=>mapped.some(m=>m.region===id));
 if(mapRegion!=='islands'&&!regions.some(([id])=>id===mapRegion))mapRegion='islands';
 const shown=mapRegion==='islands'?mapped:mapped.filter(m=>m.region===mapRegion),alerts=priorityData.sets.length;
 const content=!mapped.length?empty('No mapped centers in this selection','Preheat audiences and unconfirmed locations are listed below.'):mapRegion==='islands'?geographicIslandsScene(mapped,regions):mapRegion==='metro'?geographicCenterScene(shown):`<div class="map-local-land"></div><div class="map-local-caption">${esc(MAP_REGIONS[mapRegion].name)}</div><div class="map-local-grid">${shown.map(m=>mapBadge(m)).join('')}</div>`;
 return `<section class="center-world" aria-label="Center performance map"><div class="map-heading"><div><span class="eyebrow">THE SPARKS NETWORK</span><h2>Your centers, at a glance.</h2><p>${esc($('brandFilter').selectedOptions[0]?.textContent)} · ${scope==='MY'?'My assignments':'All assignments'} · ${esc(dateRangeText())}${$('brandFilter').value==='SLSA'?' · Temporary shared locations':''}</p></div><div class="map-heading-actions"><button class="button secondary" data-map-filters>Filters ↓</button><button class="button primary" data-map-alerts>${alerts} ad set alerts</button></div></div><div class="map-navigation"><div class="scope-switch"><button data-map-region="islands" class="${mapRegion==='islands'?'selected':''}">Islands</button>${regions.some(([id])=>id==='metro')?`<button data-map-region="metro" class="${mapRegion==='metro'?'selected':''}">Jabodetabek</button>`:''}${regions.some(([id])=>id==='makassar')?`<button data-map-region="makassar" class="${mapRegion==='makassar'?'selected':''}">Makassar</button>`:''}</div><div class="map-zoom"><button data-map-zoom="out" aria-label="Zoom out" ${mapZoom<=1?'disabled':''}>−</button><span>${Math.round(mapZoom*100)}%</span><button data-map-zoom="in" aria-label="Zoom in" ${mapZoom>=1.8?'disabled':''}>+</button><button data-map-zoom="reset">Reset</button></div></div><div class="map-viewport" tabindex="0" aria-label="Map viewport; use zoom buttons and scroll to explore"><div class="map-scene ${!mapped.length?'empty-map-scene':mapRegion==='islands'?'islands-scene':mapRegion==='metro'?'metro-scene':'local-scene'}" style="width:${mapZoom*100}%;--map-zoom:${mapZoom}">${content}</div></div><div id="mapHover" class="map-hover" role="status" hidden></div><div class="map-footer"><div class="map-legend"><span class="good">On track</span><span class="watch">Watch</span><span class="bad">Needs attention</span><span class="off">Inactive / building</span><span class="unknown">No score / outside filters</span></div><small>North up &middot; area-level pins &middot; <a href="https://www.geoboundaries.org/api/current/gbOpen/IDN/ADM2/" target="_blank" rel="noopener">Map sources</a></small></div><div class="map-alert-tray" id="mapAlertTray" hidden><h3>Ad set alerts · last 7 days</h3>${priorityData.sets.length?priorityData.sets.map((a,i)=>`<button data-priority-set="${i}"><b>${esc(a.center)}</b><span>${esc(a.name)}<small>${esc(a.issues[0]?.text)}</small></span><span>↗</span></button>`).join(''):'<p>No active ad set alerts in this selection.</p>'}</div>${unmapped.length?`<details class="map-unmapped"><summary>Unmapped locations / preheat · ${unmapped.length}</summary><div>${unmapped.map(m=>`<button class="tone-${m.tone}" data-map-center="${esc(m.id)}">${esc(m.code)} · ${esc(m.label)}${m.alerts.length?' · '+m.alerts.length+' alerts':''}</button>`).join('')}</div></details>`:''}<details class="map-method"><summary>Map status rules</summary><p>Colors use the selected period and latest recorded ad delivery, not live Meta status. English costs use Analysis Settings; green requires all costs below 90% of target, Results → Leads ≥80%, sufficient spend and Results. Yellow: costs approach target or conversion <80%. Red: CPR/CPL >120% of target, CPB >133% of target, conversion <60%, or confirmed zero outcomes after sufficient spend. Missing reports, unknown delivery, mixed Results and small samples are unscored. SLSA needs its own center-scoped monthly targets. Alert counts use the separate seven-day action window; a green center can still contain an ad needing review.</p><p>Locations follow supplied addresses. CL.JU shares one report across three branches; Depok uses a city-level report for two supplied locations. Other unverified codes remain in Unmapped locations, never assigned to a guessed address. Visible locations follow My/All assignments, center and work filters. Specific account, campaign, search and key-message filters show only matching locations. Third-account ownership stays restricted to the assigned ad set. Makassar is a city-level marker, not a confirmed branch address. Pins represent approximate areas; label connectors retain their geographic anchor. Gray means confirmed inactive or under construction, not missing data.</p><p>Administrative boundaries: BPS / WFP / OCHA via geoBoundaries, CC BY 3.0 IGO (2020 boundaries, simplified for display). Island outlines: Natural Earth, public domain. Pin anchors are approximate interpretations of the supplied addresses; geographic shapes are not a street-navigation service.</p></details></section>`;
}
function refreshCenterMap(recompute=true){const slot=$('overviewMapSlot');if(slot)slot.innerHTML=renderCenterMap(recompute);}
function mapSummary(m){return `<div class="map-metrics">${SCORECARD_METRICS.map(([k,label])=>{const r=MetricScorecards.read(m.s,k);return `<div><span>${label}</span><b>${scorecardFormat(r.value,k)}${r.partial?'*':''}</b></div>`;}).join('')}</div>${m.s.leadRows<m.s.rows||m.s.bookingRows<m.s.rows?'<p class="mini-note">* Incomplete outcome reports; values use available matched records.</p>':''}`;}
function scopedMapTable(){
 const saved={selected,base,creatives,adsetDetails,adsetMetric,adsetOrder,adsetDelivery,expanded:[...expandedAdsets]};
 try{selected=mapFocus.items;base=base.filter(r=>r.brand===mapFocus.brand&&mapFocus.codes.includes(r.center));creatives=creatives.filter(g=>g.brand===mapFocus.brand&&mapFocus.codes.includes(g.center));adsetMetric=mapTableState.metric;adsetOrder=mapTableState.order;adsetDelivery=mapTableState.delivery;expandedAdsets.clear();mapTableState.expanded.forEach(k=>expandedAdsets.add(k));const html=renderAdsetPerformance();mapAdDetails=adsetDetails.map(g=>({...g,id:g.id.replace('adset_ad_','map_ad_')}));return html.replaceAll('adset_ad_','map_ad_').replace(/(id|for)="(adsetDelivery|adsetMetric|adsetOrder)"/g,'$1="map_$2"');}
 finally{selected=saved.selected;base=saved.base;creatives=saved.creatives;adsetDetails=saved.adsetDetails;adsetMetric=saved.adsetMetric;adsetOrder=saved.adsetOrder;adsetDelivery=saved.adsetDelivery;expandedAdsets.clear();saved.expanded.forEach(k=>expandedAdsets.add(k));}
}
function renderMapDetailBody(){
 const m=mapFocus;if(!m)return '';
 if(mapTab==='sets')return scopedMapTable();
 if(mapTab==='weekly'){
  const all=MetricScorecards.build(m.items,$('startFilter').value,$('endFilter').value,latestSourceDay()),end=all.length-mapWeekPage*4,weeks=all.slice(Math.max(0,end-4),end);
  return `<div class="map-week-controls"><div class="scope-switch">${Object.entries(SCORECARD_PAIRS).map(([id,p])=>`<button data-map-pair="${id}" class="${mapPair===id?'selected':''}">${p.label}</button>`).join('')}<button data-map-pair="spend" class="${mapPair==='spend'?'selected':''}">Spend</button></div><button class="text-button" data-map-weeks="older" ${end<=4?'disabled':''}>← Earlier</button><button class="text-button" data-map-weeks="newer" ${mapWeekPage===0?'disabled':''}>Later →</button></div>${weeks.length?`<div class="sc-grid">${(mapPair==='spend'?['spend','results']:SCORECARD_PAIRS[mapPair].keys).map(k=>scorecardTable(weeks,k,false,m.brand==='English')).join('')}</div>`:empty('No weekly data','Adjust the global date range or filters.')}<p class="mini-note">Week Num from Raw Data · WoW uses matching weekdays. * Incomplete reports. Operational colors use dashboard thresholds; no brand-wide monthly target is applied to an individual center.</p>`;
 }
 return `${mapSummary(m)}<div class="map-detail-columns"><section><h3>Locations ${m.brand==='SLSA'?'<small>Temporary shared addresses</small>':''}</h3>${m.shared?'<p class="mini-note">Shared report. These outcomes cannot be attributed to individual branches.</p>':''}${m.sites.length?m.sites.map(([name,address])=>`<article class="map-address"><b>${esc(name)}</b><p>${esc(address)}</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Sparks English '+name+' '+address)}" target="_blank" rel="noopener">Open address ↗</a></article>`).join(''):`<p>${esc(m.locationNote||'Address not mapped yet.')}</p>`}</section><section><h3>Ad set alerts <small>Last 7 days</small></h3>${m.alerts.length?m.alerts.map(a=>`<button class="map-detail-alert" data-map-review="${esc(adsetIdentity(a.items[0]))}"><b>${esc(a.adset)}</b><span>${esc(a.issues[0]?.text)}</span><small>${esc(a.start)} – ${esc(a.end)}</small></button>`).join(''):'<p>No ad set alerts in this selection.</p>'}</section></div>`;
}
function refreshMapDetail(){if($('mapDetailBody'))$('mapDetailBody').innerHTML=renderMapDetailBody();document.querySelectorAll('[data-map-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.mapTab===mapTab));}
function openMapCenter(id){
 const m=mapModels.find(m=>m.id===id);if(!m)return;mapFocus=m;mapTab='summary';mapWeekPage=0;mapTableState={delivery:'active',metric:'cpr',order:'best',expanded:new Set()};
 let dialog=$('centerMapDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='centerMapDialog';document.body.append(dialog);}dialog.setAttribute('aria-labelledby','mapDetailTitle');
 dialog.innerHTML=`<header class="map-detail-header"><div><span class="eyebrow">${esc(m.brand==='English'?'SPARKS ENGLISH':'SLSA')} · ${esc(m.code)}</span><h2 id="mapDetailTitle">${esc(m.name)}</h2><p>${esc(dateRangeText())} · <b class="map-state tone-${m.tone}">${esc(m.label)}</b></p><small>${esc(m.reason)}</small></div><button class="icon-button" data-map-close aria-label="Close center detail">×</button></header><nav class="map-detail-tabs scope-switch" aria-label="Center detail"><button data-map-tab="summary" class="selected">Summary</button><button data-map-tab="weekly">Weekly scorecards</button><button data-map-tab="sets">Ad sets & ads</button></nav><div id="mapDetailBody">${renderMapDetailBody()}</div>`;
 dialog.showModal();if($('mapHover'))$('mapHover').hidden=true;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mapRegion){if(b.dataset.mapRegion==='makassar'){const ms=mapModels.filter(m=>m.code==='MKS');if(ms.length===1){openMapCenter(ms[0].id);return;}}mapRegion=b.dataset.mapRegion;mapZoom=1;refreshCenterMap(false);return;}
 if(b.dataset.mapZoom){mapZoom=b.dataset.mapZoom==='reset'?1:Math.max(1,Math.min(1.8,mapZoom+(b.dataset.mapZoom==='in'?.2:-.2)));refreshCenterMap(false);return;}
 if(b.dataset.mapCenter){b.classList.add('map-selected');openMapCenter(b.dataset.mapCenter);return;}
 if(b.hasAttribute('data-map-close')){$('centerMapDialog').close();return;}
 if(b.hasAttribute('data-map-filters')){document.querySelector('.filter-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
 if(b.hasAttribute('data-map-alerts')){$('mapAlertTray').hidden=!$('mapAlertTray').hidden;if(!$('mapAlertTray').hidden)$('mapAlertTray').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
 if(b.dataset.mapTab){mapTab=b.dataset.mapTab;refreshMapDetail();return;}
 if(b.dataset.mapPair){mapPair=b.dataset.mapPair;refreshMapDetail();return;}
 if(b.dataset.mapWeeks){mapWeekPage+=b.dataset.mapWeeks==='older'?1:-1;refreshMapDetail();return;}
 if(b.dataset.mapReview){mapTab='sets';mapTableState.expanded.add(b.dataset.mapReview);refreshMapDetail();return;}
 if(b.closest('#centerMapDialog')&&b.dataset.adsetToggle!==undefined){e.stopImmediatePropagation();const key=b.dataset.adsetToggle;mapTableState.expanded.has(key)?mapTableState.expanded.delete(key):mapTableState.expanded.add(key);refreshMapDetail();}
});
document.addEventListener('change',e=>{if(!e.target.closest('#centerMapDialog'))return;const key={map_adsetDelivery:'delivery',map_adsetMetric:'metric',map_adsetOrder:'order'}[e.target.id];if(key){e.stopImmediatePropagation();mapTableState[key]=e.target.value;refreshMapDetail();}});
function previewMapCenter(target){const b=target.closest('[data-map-center]'),tip=$('mapHover');if(!tip||!b)return;const m=mapModels.find(m=>m.id===b.dataset.mapCenter);if(!m)return;mapPreviewId=m.id;tip.innerHTML=`<b>${esc(m.name)} · ${esc(m.label)}</b><span>${esc(m.brand)} · ${integer(MetricScorecards.read(m.s,'results').value)} Results · ${integer(overviewReading(m.s,'leads').value)} Leads · ${integer(overviewReading(m.s,'booking').value)} Booking</span><small>${esc(m.reason)}${m.alerts.length?' · '+m.alerts.length+' ad set alerts (7D)':''}</small>`;tip.hidden=false;}
document.addEventListener('pointerover',e=>previewMapCenter(e.target));document.addEventListener('focusin',e=>previewMapCenter(e.target));
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-map-center]')&&!e.relatedTarget?.closest('[data-map-center]')&&$('mapHover'))$('mapHover').hidden=true;});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-map-center]')&&$('mapHover'))$('mapHover').hidden=true;});
let mapDrag=null;
document.addEventListener('pointerdown',e=>{const v=e.target.closest('.map-viewport');if(!v||e.pointerType!=='mouse'||e.button!==0||e.target.closest('button'))return;mapDrag={v,x:e.clientX,y:e.clientY,left:v.scrollLeft,top:v.scrollTop};v.setPointerCapture(e.pointerId);v.classList.add('map-dragging');});
document.addEventListener('pointermove',e=>{if(!mapDrag)return;mapDrag.v.scrollLeft=mapDrag.left+mapDrag.x-e.clientX;mapDrag.v.scrollTop=mapDrag.top+mapDrag.y-e.clientY;});
function endMapDrag(){mapDrag?.v.classList.remove('map-dragging');mapDrag=null;}
document.addEventListener('pointerup',endMapDrag);document.addEventListener('pointercancel',endMapDrag);
