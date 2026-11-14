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
function iterationCost(value,benchmark){
  if(benchmark===null)return `${money(value)}<small>Benchmark belum lengkap</small>`;
  if(!Number.isFinite(benchmark))return `${money(value)}<small>Center belum menghasilkan konversi</small>`;
  const d=benchmark>0?(value/benchmark-1)*100:null;
  return `${money(value)}<small>Center ${money(benchmark)}${d===null||value===null?'':` · ${percent(Math.abs(d))} ${d>0?'lebih mahal':'lebih murah'}`}</small>`;
}
function renderIteration(wins){
  return `<section class="card iteration-panel" id="iterationCandidates"><div class="card-heading"><div><h2>Creatives to iterate next</h2><p>${integer(wins.length)} ads / Last 7 days</p></div></div><div class="card-body">${Iteration.categories.map(c=>{
    const list=wins.filter(g=>g.opportunities.some(o=>o.key===c.key)).sort((a,b)=>b[c.key]-a[c.key]||a[c.cost]-b[c.cost]);
    return `<h3 class="iteration-title">${c.label} opportunities <span class="pill">${list.length} ad</span></h3>${!list.length?`<p class="mini-note">Belum ada kandidat ${c.label} dengan minimum spend dan Results terpenuhi, ${c.costLabel} tidak melebihi rata-rata ad lain di ad set ini, dan data pembanding lengkap.</p>`:`<div class="table-wrap"><table><thead><tr><th>Ad / ad set</th><th>Alasan terpilih</th><th>Penayangan & sampel</th><th class="num">Results / CPR</th><th class="num">Leads / CPL</th><th class="num">Booking / CPB</th><th class="num">Leads → Booking (%)</th><th class="num">Spend share</th><th>Fokus iterasi</th></tr></thead><tbody>${list.map(g=>{
      const o=g.opportunities.find(o=>o.key===c.key),b=g.iterationBenchmark;
      const benchmark=k=>g.iterationBenchmarkCosts?g.iterationBenchmarkCosts[k]??null:b[k]===null?(b[k==='cpr'?'results':k==='cpl'?'leads':'booking']===0&&b.spend>0&&(k==='cpr'||b[k==='cpl'?'leadRows':'bookingRows']===b.rows)?Infinity:null):b[k];
      return `<tr><td class="cell-name"><button class="ad-link" data-detail="${g.id}">${esc(g.ad)}</button><small>${esc(g.center)} · ${esc(g.adset)}</small>${accountBadge(g.account)}<small>${esc(g.campaign)} · ${esc(g.resultType)}</small><small class="${g.missing?'red-text':''}">${esc(g.message||'Key message belum diisi')}${g.message&&g.missing?' · sebagian baris kosong':''}</small></td><td class="cell-name"><b>${esc(o.reason)}</b><small>${integer(g[c.key])} ${c.label} · ${o.costLabel} ${money(g[c.cost])}</small><small>${g.cpr>config.target?'CPR masih di atas target':'CPR memenuhi target'}</small></td><td>${actionStatus(g)}<small>${esc(g.lastDelivery)} · spend ${money(g.spend)}</small><small>${o.early?'Sinyal awal — kurang dari '+config.minResults+' '+c.label:'Sampel operasional terpenuhi; bukan bukti statistik'}</small></td><td class="num">${integer(g.results)} Results<small>${iterationCost(g.cpr,benchmark('cpr'))}</small></td><td class="num">${g.leadRows===g.rows?integer(g.leads):'—'} Leads<small>${iterationCost(g.cpl,benchmark('cpl'))}</small></td><td class="num">${g.bookingRows===g.rows?integer(g.booking):'—'} Booking<small>${iterationCost(g.cpb,benchmark('cpb'))}</small></td><td class="num">${percent(g.bookingRate)}</td><td class="num">${percent(g.share)}</td><td class="cell-name">${esc(iterationAction(g))}<small>CTR ${percent(g.ctr)} · Hook ${percent(g.hook)} · Views ${percent(g.view)} · Frequency ≈ ${decimal(g.frequency)}</small><button class="button secondary" data-meeting-ad="${g.id}" data-meeting-action="iterate">Tambah ke meeting</button><button class="text-button" data-detail="${g.id}">Tinjau creative →</button></td></tr>`;
    }).join('')}</tbody></table></div>`}`;
  }).join('')}</div></section>`;
}
function iterationMethodology(){return `<section class="card method"><h3>Iteration methodology</h3><ul><li>Daftar ini sama dengan status Layak iterate dan Prioritaskan delivery. Kill, inactive, data tidak lengkap, dan pengecualian review tidak masuk daftar.</li><li>Evaluasi memakai 7 hari terakhir; spend minimal ${money(config.minSpend)} dan Results minimal ${config.minResults}. Leads dan Booking harus lengkap.</li><li>Booking/CPB, Leads/CPL, dan Results/CPR dinilai terpisah. Kategori harus menghasilkan minimal ${config.minResults} Results, Leads, atau Booking dan memenuhi target biaya ATAU tidak melebihi rata-rata center yang cukup: CPR ${money(CostTargets.limit('cpr',config))}, CPL ${money(CostTargets.limit('cpl',config))}, CPB ${money(CostTargets.limit('cpb',config))}. Rata-rata center = total spend peer / hasil, tanpa ad ini, data lengkap, center/brand/jenis Results serta scope account dan periode yang sama. Warna CPB mengikuti tier safe/warning/review/kill. CPB di atas Rp300.000 memerlukan warning atau review sebelum dapat menjadi kandidat iterate otomatis; CPB di atas Rp500.000 mengikuti K5.</li><li>Kandidat yang memenuhi target tidak dikeluarkan hanya karena ad lain lebih murah atau menghasilkan lebih banyak. Tidak ada kuota kandidat.</li><li>Spend share di bawah 1% pada kandidat menghasilkan Prioritaskan delivery. Additional metrics buruk hanya menambahkan Evaluasi creative. CPR di atas target tetap dijelaskan jika kandidat hanya unggul pada CPL atau CPB.</li><li>Setiap kategori memerlukan minimal ${config.minResults} hasilnya sendiri. Hasil ini bukan bukti sebab-akibat creative; tinjau materi, key message dan pillar sebelum iterate.</li></ul></section>`;}
