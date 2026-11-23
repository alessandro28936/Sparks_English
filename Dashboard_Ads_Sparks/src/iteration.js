/* Target-qualified creative learning, shared by action recommendations. */
const Iteration=(()=>{
  const categories=[{key:'booking',cost:'cpb',label:'Booking',costLabel:'CPB'},{key:'leads',cost:'cpl',label:'Leads',costLabel:'CPL'},{key:'results',cost:'cpr',label:'Results',costLabel:'CPR'}];
  const sameSet=(a,b)=>['center','brand','account','campaign','adset','objective','resultType'].every(k=>a[k]===b[k]);
  const complete=(s,c)=>c.key==='results'||s[c.key==='leads'?'leadRows':'bookingRows']===s.rows;
  function select(ads,source,settings,centerSource=source){
    const found=[];
    for(const ad of ads){
      if(ad.state==='KILL'||ad.mixed||ad.resultType==='Tidak tercatat'||!ad.resultType||ad.spend<settings.minSpend||ad.results<settings.minResults)continue;
      const centerPool=centerSource.filter(r=>r.center===ad.center&&A.sameMetricContext(r,ad)&&r.day>=ad.start&&r.day<=ad.end);
      const peers=centerPool.filter(r=>A.adIdentity(r)!==A.adIdentity(ad));
      const benchmark=A.aggregate(peers),opportunities=[],iterationBenchmarkCosts={};
      for(const c of categories){
        const reference=CostTargets.benchmark(centerPool,ad.items||[],c.cost,settings),peerCost=reference.cost;
        iterationBenchmarkCosts[c.cost]=peerCost;
        if(!complete(ad,c)||ad[c.key]<settings.minResults||!CostTargets.qualifies(ad[c.cost],c.cost,settings,reference))continue;
        opportunities.push({...c,peerCost,delta:peerCost>0?(ad[c.cost]/peerCost-1)*100:null,reason:`${ad[c.key]} ${c.label}; ${c.costLabel} Rp${Math.round(ad[c.cost]).toLocaleString('id-ID')} ${CostTargets.meets(ad[c.cost],c.cost,settings)?'memenuhi target Rp'+CostTargets.limit(c.cost,settings).toLocaleString('id-ID'):'di atas target, tetapi dalam rata-rata center Rp'+Math.round(peerCost).toLocaleString('id-ID')}`,early:false});
      }
      if(opportunities.length)found.push({...ad,opportunities,iterationBenchmark:benchmark,iterationBenchmarkCosts});
    }
    return found;
  }
  return {categories,select};
})();
function actionMetrics(g){return {...g,...g.operational,id:g.id,state:g.state,diagnosis:g.diagnosis,actionEvidence:g.actionEvidence,creativeEvaluation:g.creativeEvaluation,opportunities:g.opportunities,iterationBenchmark:g.iterationBenchmark,iterationBenchmarkCosts:g.iterationBenchmarkCosts};}
function candidates(){return creatives.filter(g=>['ITERATE','OPPORTUNITY'].includes(g.state)&&g.opportunities?.length).map(actionMetrics);}
function iterationAction(g){
  const actions=[];
  if(g.hook!==null&&g.hook<=25)actions.push('Uji opening 3 detik pertama');
  if(g.view!==null&&g.view<=30)actions.push('Uji durasi, pacing, dan urutan pesan');
  if(g.ctr!==null&&g.ctr<1)actions.push('Uji visual, penawaran, dan CTA');
  if(g.frequency!==null&&g.frequency>3)actions.push('Uji variasi materi dan audience untuk memeriksa kejenuhan');
  if(g.share!==null&&g.share<1)actions.push('Tinjau distribusi spend di ad set sebelum menambah delivery');
  if(!actions.length)actions.push('Uji satu variasi hook atau visual; pertahankan pesan setelah materi ditinjau');
  return actions.join('. ')+'.';
}
let meetingIterationCategory='booking';
function renderIteration(wins){
  const groups=Iteration.categories.map(category=>({
    ...category,ads:wins.filter(g=>g.opportunities.some(o=>o.key===category.key))
  }));
  const category=groups.find(c=>c.key===meetingIterationCategory&&c.ads.length)||groups.find(c=>c.ads.length)||groups[0];
  const {key,cost,label,costLabel,ads}=category;
  ads.sort((a,b)=>b[key]-a[key]||a[cost]-b[cost]||a.ad.localeCompare(b.ad));
  const columns=AD_PERIOD_METRICS.filter(([id])=>id===key||id===cost),maxima=meetingBarMaxima(ads);
  return `<section class="card adset-performance meeting-iteration" id="iterationCandidates" aria-label="Iteration candidates">
    <header class="meeting-list-heading"><div><h2>Iteration candidates <span>${integer(wins.length)}</span></h2><p>${esc(meetingActionPeriod())}</p></div>
    ${wins.length?`<div class="scope-switch meeting-switch" role="group" aria-label="Iteration outcome">${groups.map(c=>`<button type="button" data-iteration-category="${c.key}" aria-pressed="${key===c.key}" class="${key===c.key?'selected':''}" ${c.ads.length?'':'disabled'}>${c.label} <span>${integer(c.ads.length)}</span></button>`).join('')}</div>`:''}</header>
    ${ads.length?`<div class="table-wrap" role="region" aria-label="${label} candidates" tabindex="0"><table>
      <thead><tr><th scope="col">Ad / ad set</th><th scope="col" class="num">${label}</th><th scope="col" class="num">${costLabel}</th><th scope="col">Why iterate</th><th scope="col">Key message / pillar</th><th scope="col">Action</th></tr></thead>
      <tbody>${ads.map(g=>{
        const o=g.opportunities.find(item=>item.key===key);
        const target=CostTargets.meets(g[cost],cost,config);
        const reference=target?CostTargets.limit(cost,config):o.peerCost;
        const reason=Number.isFinite(reference)?`${costLabel} ≤ ${target?'target':'center average'} ${money(reference)}`:o.reason;
        return `<tr>${meetingAdIdentityCell(g)}
          ${adsetMetricCells(g,g.share,[],{columns,compact:true,maxima})}
          <td class="meeting-iteration-reason">${esc(reason)}${g.state==='OPPORTUNITY'?`<small>Spend share ${percent(g.share)}</small>`:''}</td>
          <td class="meeting-message"><span title="${esc(g.message)}">${esc(g.message||'Key message missing')}</span>${g.pillar?`<small title="${esc(g.pillar)}">${esc(g.pillar)}</small>`:''}</td>
          ${meetingBucketCell(g,'iterate',key)}</tr>`;
      }).join('')}</tbody></table></div>`:'<p class="meeting-list-empty">No ads qualify for iteration in this action window.</p>'}
  </section>`;
}
function iterationMethodology(){return `<section class="card method"><h3>Iteration methodology</h3><ul><li>Daftar ini sama dengan status Layak iterate dan Prioritaskan delivery. Kill, inactive, data tidak lengkap, dan pengecualian review tidak masuk daftar.</li><li>Evaluasi memakai 7 hari terakhir; spend minimal ${money(config.minSpend)} dan Results minimal ${config.minResults}. Leads dan Booking harus lengkap.</li><li>Booking/CPB, Leads/CPL, dan Results/CPR dinilai terpisah. Kategori harus menghasilkan minimal ${config.minResults} Results, Leads, atau Booking dan memenuhi target biaya ATAU tidak melebihi rata-rata center yang cukup: CPR ${money(CostTargets.limit('cpr',config))}, CPL ${money(CostTargets.limit('cpl',config))}, CPB ${money(CostTargets.limit('cpb',config))}. Rata-rata center = total spend peer / hasil, tanpa ad ini, data lengkap, center/brand/jenis Results serta scope account dan periode yang sama. Warna CPB mengikuti tier safe/warning/review/kill. CPB di atas Rp300.000 memerlukan warning atau review sebelum dapat menjadi kandidat iterate otomatis; CPB di atas Rp500.000 mengikuti K5.</li><li>Kandidat yang memenuhi target tidak dikeluarkan hanya karena ad lain lebih murah atau menghasilkan lebih banyak. Tidak ada kuota kandidat.</li><li>Spend share di bawah 1% pada kandidat menghasilkan Prioritaskan delivery. Additional metrics buruk hanya menambahkan Evaluasi creative. CPR di atas target tetap dijelaskan jika kandidat hanya unggul pada CPL atau CPB.</li><li>Setiap kategori memerlukan minimal ${config.minResults} hasilnya sendiri. Hasil ini bukan bukti sebab-akibat creative; tinjau materi, key message dan pillar sebelum iterate.</li></ul></section>`;}
