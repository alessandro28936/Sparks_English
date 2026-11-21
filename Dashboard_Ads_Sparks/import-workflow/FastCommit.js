/* Bundled into SparksImport.gs by build_import_ui.py. */
function buildImportOutput(old,p,now,deltaOnly=false){
 const headers=old[0],sourceCol=headers.indexOf('Import Source'),dayCol=headers.indexOf('Day');
 for(const h of ['Day','Import Source','Brand','Account Group','Entity Key','Report Key','Row Key','Ad ID'])if(headers.indexOf(h)<0)throw Error('Schema Raw Data belum siap: '+h);
 // Formula locations are fixed by the existing workbook schema. Stop before writing if columns moved.
 for(const [col,name] of [[2,'Ad set trim'],[4,'Ad Trim'],[5,'Day'],[30,'Leads'],[31,'Booking'],[39,'Import Source'],[47,'Account ID'],[50,'Ad ID']])if(headers[col]!==name)throw Error('Kolom Raw Data berubah: '+name+'. Batalkan impor dan periksa schema.');
 const newKeys=p.mode==='upsert'?new Set(p.rows.map(identity)):null,newNames=p.mode==='upsert'?new Set(p.rows.map(nameIdentity)):null,keep=[],removed=[],slots=[];
 let retained=0;
 for(let i=1;i<old.length;i++){
  const v=old[i];if(!v[0]){slots.push(i);continue;}
  if(v[sourceCol]!==p.source){retained++;if(!deltaOnly)keep.push(v);continue;}
  const r={'Import Source':p.source,'Campaign name':v[0],'Ad set name':v[1],'Ad name':v[3],Day:v[dayCol],'Ad ID':v[50]};
  let replace;
  try{replace=p.mode==='replace'?dateKey(r.Day)>=p.start&&dateKey(r.Day)<=p.end:newKeys.has(identity(r))||(!r['Ad ID']&&newNames.has(nameIdentity(r)));}
  catch(e){throw Error('Raw Data baris '+(i+1)+': '+e.message);}
  if(replace){slots.push(i);removed.push(v);}else{retained++;if(!deltaOnly)keep.push(v);}
 }
 const added=p.rows.map(r=>headers.map(h=>{
  if(['Day','Reporting starts','Reporting ends'].includes(h))return serialDate(r.Day);
  if(h==='Brand')return p.source==='SLSA'?'SLSA':'English';
  if(h==='Account Group')return p.source==='SE Main'?'Main':p.source==='SE Third'?'Third':'Secondary';
  if(h==='Imported At')return now;if(h==='Import Note')return 'Imported via Sparks Import';return r[h]??'';
 }));
 if(deltaOnly)return {headers,slots,added:added.sort((a,b)=>a[dayCol]-b[dayCol]),removed:removed.length,retained};
 // Compare export fields only: derived outcomes/labels may change independently of the Meta export.
 const excluded=new Set([...Object.keys(FORMULAS).map(Number),headers.indexOf('Imported At'),headers.indexOf('Import Note')]);
 const signature=v=>JSON.stringify(headers.map((h,j)=>excluded.has(j)?null:['Day','Reporting starts','Reporting ends'].includes(h)?dateKey(v[j]):v[j]??''));
 const counts=new Map();removed.forEach(v=>{const k=signature(v);counts.set(k,(counts.get(k)||0)+1);});
 let unchanged=removed.length===added.length;
 for(const v of added){const k=signature(v),n=counts.get(k)||0;if(!n)unchanged=false;else counts.set(k,n-1);}
 // Sort once using cached day values; avoid repeated date formatting during comparisons.
 const all=[...keep,...added].map(v=>({v,day:serialDate(v[dayCol])})).sort((a,b)=>a.day-b.day||String(a.v[sourceCol]).localeCompare(String(b.v[sourceCol]))).map(x=>x.v);
 return {headers,all,removed:removed.length,unchanged};
}
function mappingRowsForImport(mappingValues,p){
 const seen=new Set(mappingValues.slice(1).map(r=>[r[0],r[1],r[2],r[3]].join('|'))),added=[];
 const occupied=mappingValues.reduce((last,r,i)=>r[0]?i+1:last,1);
 for(const r of p.rows){const key=[p.source,r['Campaign name'],r['Ad set name'],r['Ad name']].join('|');if(seen.has(key))continue;seen.add(key);const n=occupied+added.length+1;
  const row=safeValues([[p.source,r['Campaign name'],r['Ad set name'],r['Ad name'],'','','','','Isi key message dan pillar']])[0];
  row[7]='=IF(A'+n+'="","",A'+n+'&"|"&B'+n+'&"|"&C'+n+'&"|"&D'+n+'&IF(E'+n+'="","","|"&IF(ISNUMBER(E'+n+'),TEXT(E'+n+',"yyyy-mm-dd"),E'+n+')))';added.push(row);
 }
 return {occupied,added};
}
function restoreImportValues(values,formulas){
 const output=safeValues(values);for(let i=0;i<output.length;i++)for(let j=0;j<output[i].length;j++)if(formulas[i]?.[j])output[i][j]=formulas[i][j];return output;
}
function commit(p){
 const started=Date.now(),lock=LockService.getDocumentLock();
 if(!lock.tryLock(1000))throw Error('Ada impor/proses lain yang masih berjalan. Tunggu selesai; jangan menjalankan impor bersamaan.');
 try{
  const ss=book(),raw=ss.getSheetByName('Raw Data');if(!raw)throw Error('Raw Data tidak ditemukan.');
  const oldRange=raw.getDataRange(),old=oldRange.getValues(),now=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss');
  const plan=buildImportOutput(old,p,now),mapping=ss.getSheetByName('Creative Mapping'),mapPlan=mappingRowsForImport(mapping.getDataRange().getValues(),p);
  const log=ss.getSheetByName('Import Log'),logRow=log.getLastRow()+1;
  ensureSize(log,logRow,12);
  const logHeaders=log.getRange(1,10,1,3).getValues()[0],labels=['Values backup','Formula backup','Duration (seconds)'];
  if(logHeaders.some(v=>!v))log.getRange(1,10,1,3).setValues([logHeaders.map((v,i)=>v||labels[i])]);
  if(plan.unchanged){
   if(mapPlan.added.length){ensureSize(mapping,mapPlan.occupied+mapPlan.added.length,9);mapping.getRange(mapPlan.occupied+1,1,mapPlan.added.length,9).setValues(mapPlan.added);}
   log.getRange(logRow,1,1,12).setValues([[now,p.source,'Sparks Import',p.start,p.end,p.rows.length,0,'SUCCESS','No changes','','',Math.round((Date.now()-started)/1000)]]);
   return 'Selesai: '+p.rows.length+' baris sudah identik. Tidak ada penulisan ulang Raw Data. Total '+plan.all.length+' baris. Durasi '+Math.round((Date.now()-started)/1000)+' detik.';
  }
  const output=populateFormulas(safeValues([plan.headers,...plan.all]));
  const oldFormulas=oldRange.getFormulas();
  // A passive snapshot avoids duplicating thousands of live lookup formulas in every backup.
  const stamp=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd HHmmss')+' '+Utilities.getUuid().slice(0,6);
  const backup=ss.insertSheet('Backup values '+stamp);ensureSize(backup,old.length,plan.headers.length);
  backup.getRange(2,48,Math.max(1,old.length-1),4).setNumberFormat('@');
  backup.getRange(1,1,old.length,plan.headers.length).setValues(safeValues(old));backup.hideSheet();
  // Store only unique R1C1 formula patterns, plus their column and row runs, without active formulas.
  const formulaBackup=ss.insertSheet('Backup formulas '+stamp),patterns=[];
  const r1c1=oldRange.getFormulasR1C1();
  for(let col=0;col<plan.headers.length;col++)for(let i=0;i<r1c1.length;){const formula=r1c1[i][col];if(!formula){i++;continue;}let end=i+1;while(end<r1c1.length&&r1c1[end][col]===formula)end++;patterns.push([col+1,i+1,end,JSON.stringify(formula)]);i=end;}
  ensureSize(formulaBackup,patterns.length+1,4);formulaBackup.getRange(1,1,1,4).setValues([['Column','Start row','End row','R1C1 formula (JSON)']]);
  if(patterns.length)formulaBackup.getRange(2,1,patterns.length,4).setValues(patterns);formulaBackup.hideSheet();
  log.getRange(logRow,1,1,12).setValues([[now,p.source,'Sparks Import',p.start,p.end,p.rows.length,plan.removed,'RUNNING',p.mode,backup.getName(),formulaBackup.getName(),0]]);
  let writing=false;
  try{
   if(mapPlan.added.length){ensureSize(mapping,mapPlan.occupied+mapPlan.added.length,9);mapping.getRange(mapPlan.occupied+1,1,mapPlan.added.length,9).setValues(mapPlan.added);}
   ensureSize(raw,output.length,plan.headers.length);
   raw.getRange(2,48,Math.max(old.length,output.length)-1,4).setNumberFormat('@');
   writing=true;raw.getRange(1,1,output.length,plan.headers.length).setValues(output);
   if(old.length>output.length)raw.getRange(output.length+1,1,old.length-output.length,plan.headers.length).clearContent();
   raw.getRangeList(['F2:F'+output.length,'Z2:AA'+output.length]).setNumberFormat('yyyy-mm-dd');
   SpreadsheetApp.flush();
  }catch(e){
   try{if(writing){raw.getRange(1,1,old.length,plan.headers.length).setValues(restoreImportValues(old,oldFormulas));if(output.length>old.length)raw.getRange(old.length+1,1,output.length-old.length,plan.headers.length).clearContent();SpreadsheetApp.flush();}
    log.getRange(logRow,8).setValue('FAILED — restored');
   }catch(restoreError){throw Error('Impor gagal; pemulihan otomatis belum terkonfirmasi. Backup: '+backup.getName()+' + '+formulaBackup.getName()+'. '+e.message+' / '+restoreError.message);}
   throw Error('Impor gagal; Raw Data dipulihkan. Backup: '+backup.getName()+'. '+e.message);
  }
  const issues=ss.getSheetByName('Import Issues');
  if(p.duplicates.length){const issueRow=issues.getLastRow()+1;ensureSize(issues,issueRow+p.duplicates.length-1,5);issues.getRange(issueRow,1,p.duplicates.length,5).setValues(safeValues(p.duplicates.map(([key,n])=>['DUPLICATE EXPORT IDENTITY',p.source,key,n,'Identitas berulang; periksa export. Baris tetap disimpan.'])));}
  const seconds=Math.round((Date.now()-started)/1000);log.getRange(logRow,8).setValue('SUCCESS');log.getRange(logRow,12).setValue(seconds);
  return 'Berhasil: '+p.rows.length+' baris diimpor. Total Raw Data '+plan.all.length+' baris. Durasi '+seconds+' detik. Backup: '+backup.getName()+'.';
 }finally{lock.releaseLock();}
}
