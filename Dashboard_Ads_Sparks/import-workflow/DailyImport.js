/* Daily Report exports are outcomes, not Meta exports. Repeated rows are additive. */
const DAILY_TAB='Copy of Daily Report';
const DAILY_HEADERS=['calendar_date','Ads Center','Adset Name','ad_name','CPB by Chat Date','CPB by Booking Date','CPL','CPR','Spend','Bookings by Chat Date','CVR by Chat Date','Bookings by Booking Date','CVR by Booking Date','Results to Leads','Leads','Results','NS'];
const DAILY_IDS=['Account Group','Account ID','Campaign ID','Ad Set ID','Ad ID'];
// User confirmed 2026-11-12: the latest CSV replaces prior outcomes within the selected import scope,
// including earlier additional-result rows. Never deduplicate repeated rows inside the new CSV.
function dailyNumber(v,h,row,required){
 let s=String(v??'').trim().replace(/^'/,'');
 if(['','-','—','null','N/A'].includes(s)){if(required)throw Error(h+' kosong pada baris '+row+'. Isi 0 hanya jika benar-benar nol.');return '';}
 const percent=s.endsWith('%');if(percent)s=s.slice(0,-1);
 if(!/^\d+(\.\d+)?$/.test(s)||!Number.isFinite(Number(s)))throw Error('Angka tidak valid pada '+h+', baris '+row+': '+v);
 const n=Number(s)/(percent?100:1);
 if(percent&&!['CVR by Chat Date','CVR by Booking Date','Results to Leads'].includes(h))throw Error('Persentase tidak valid pada '+h+', baris '+row);
 if(['Bookings by Chat Date','Bookings by Booking Date','Leads','Results','NS'].includes(h)&&!Number.isSafeInteger(n))throw Error(h+' harus bilangan bulat: baris '+row);
 return n;
}
function dailyAccount(r){return String(r[26]||(/(?:^|_)TA(?:_|$)/i.test(r[2])?'Third':'')).trim();}
function dailyBase(r){return JSON.stringify([dateKey(r[0]),...r.slice(1,4).map(v=>String(v).trim())]);}
function dailyContext(r){return JSON.stringify([dailyAccount(r),...r.slice(27,31).map(v=>String(v??'').trim())]);}
function dailyKey(r){return dailyBase(r)+'|'+dailyContext(r);}
function dailyLabel(value){const s=String(value??'').trim();return !s||/^(?:'?[-–—]|n\/a|null|none)$/i.test(s)||/^#(?:REF!|N\/A|VALUE!|DIV\/0!|ERROR!|NAME\?|NUM!|SPILL!)/i.test(s)?'':s;}
function prepareDaily(data,mode,start,end){
 if(!['upsert','replace'].includes(mode))throw Error('Mode tidak valid.');
 const names=[...DAILY_HEADERS,...DAILY_IDS],headers=(data[0]||[]).map(h=>{h=String(h).trim();return /^date$/i.test(h)?'calendar_date':names.find(n=>n.toLowerCase()===h.toLowerCase())||h;});
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Header kosong atau duplikat.');
 if(!headers.includes('calendar_date'))throw Error('Daily Report memerlukan calendar_date (yyyy-mm-dd). Export Week saja tidak bisa diimpor; gunakan breakdown harian.');
 for(const h of DAILY_HEADERS)if(!headers.includes(h))throw Error('Kolom Daily Report wajib tidak ada: '+h);
 const rows=[],provided=DAILY_IDS.map(h=>headers.includes(h));
 for(let i=1;i<data.length;i++){
  const v=data[i];if(v.every(x=>x===''||x==null))continue;
  if(v.length!==headers.length)throw Error('Jumlah kolom tidak sesuai pada baris '+(i+1));
  const obj=Object.fromEntries(headers.map((h,j)=>[h,v[j]])),r=Array(31).fill('');
  const day=dateKey(obj.calendar_date);if(day<'2026-07-01')throw Error('Baris '+(i+1)+' sebelum 1 Juli 2026. Export hanya Juli dan seterusnya.');r[0]=serialDate(day);
  for(let j=1;j<4;j++){r[j]=String(obj[DAILY_HEADERS[j]]||'').trim();if(!r[j])throw Error(DAILY_HEADERS[j]+' kosong pada baris '+(i+1));}
  if(/(?:^|[^A-Z0-9])SLSA(?:$|[^A-Z0-9])/i.test(r[2]))throw Error('Daily Report ini untuk Sparks English. Data SLSA memakai sheet Daily Report SLSA.');
  // Previously confirmed typo: preserve its correction on re-import, scoped to this report identity.
  if(day==='2026-11-09'&&/^(?:CL\.)?JU_T_D_W_TA$/i.test(r[2])&&r[3]==='VEXTR_30/')r[3]='VEXTR_30';
  for(let j=4;j<17;j++)r[j]=dailyNumber(obj[DAILY_HEADERS[j]],DAILY_HEADERS[j],i+1,[8,11,14,15].includes(j));
  DAILY_IDS.forEach((h,j)=>{if(!provided[j])return;const s=String(obj[h]||'').trim();r[26+j]=j?importId(s,h,i+1):s;if(!j&&s&&!['Main','Secondary','Third'].includes(s))throw Error('Account Group harus Main, Secondary atau Third: baris '+(i+1));});
  if(/(?:^|_)TA(?:_|$)/i.test(r[2])&&r[26]&&r[26]!=='Third')throw Error('_TA adalah Third account: baris '+(i+1));
  if(r[30]&&!r[27])throw Error('Ad ID memerlukan Account ID: baris '+(i+1));
  rows.push(r);
 }
 if(!rows.length)throw Error('Tidak ada baris Daily Report.');
 const dates=rows.map(r=>dateKey(r[0])).sort();
 if(mode==='replace'){start=dateKey(start);end=dateKey(end);if(start<'2026-07-01'||start>end||dates[0]<start||dates.at(-1)>end)throw Error('Tanggal file di luar rentang penggantian.');}
 else{start=dates[0];end=dates.at(-1);}
 const counts=new Map();rows.forEach(r=>counts.set(dailyKey(r),(counts.get(dailyKey(r))||0)+1));
 const fingerprint=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({source:'Daily Report',rows,provided,mode,start,end})));
 return {source:'Daily Report',rows,provided,mode,start,end,fileStart:dates[0],fileEnd:dates.at(-1),fingerprint,duplicates:[...counts.values()].reduce((s,n)=>s+Math.max(0,n-1),0)};
}
function dailySummary(p){
 const sum=j=>p.rows.reduce((s,r)=>s+Number(r[j]||0),0).toLocaleString('id-ID');
 const rangeWarning=p.mode==='replace'&&(p.start!==p.fileStart||p.end!==p.fileEnd)?'\nPERHATIAN: CSV hanya mencakup '+p.fileStart+' s.d. '+p.fileEnd+'. Data lama di luar tanggal file tetapi di dalam rentang penggantian juga akan dihapus. Sesuaikan Start/End date jika tidak dimaksudkan.':'';
 return p.rows.length+' baris | '+DAILY_TAB+' | '+p.start+' s.d. '+p.end+'\nLeads: '+sum(14)+' | Booking (Booking Date): '+sum(11)+' | Results: '+sum(15)+'\nSpend: Rp'+sum(8)+'\n'+p.duplicates+' baris dengan identitas berulang tetap dihitung sebagai hasil tambahan.\n'+(p.mode==='replace'?'PERHATIAN: mengganti SEMUA center/account dalam rentang ini di Copy of Daily Report. Gunakan hanya export lengkap semua center.':'Memperbarui kelompok tanggal + center + ad set + ad dalam file. Baris lain tetap. Upload ulang tidak menambah salinan.')+rangeWarning;
}
function dailyPreview(p){
 const lock=LockService.getDocumentLock();if(!lock.tryLock(1))throw Error('Importer sedang digunakan. Tunggu proses tersebut selesai, lalu Preview lagi.');
 try{const sheet=book().getSheetByName(DAILY_TAB);if(!sheet)throw Error(DAILY_TAB+' tidak ditemukan.');const window=dailyReadWindow(sheet,p),delta=dailyDelta(window.old,p);return dailySummary(p)+'\nPerubahan: '+delta.changes.length+' baris diperbarui, '+delta.clear.length+' baris lama diganti. Total sesudah import: '+(window.prefixCount+delta.count)+' baris.\n'+delta.labels.length+' Key Messages dari baris yang diganti akan disimpan di Daily Report Labels.';}
 finally{lock.releaseLock();}
}
function dailyReadWindow(sheet,p){
 const last=sheet.getLastRow(),header=sheet.getRange(1,1,1,31).getValues()[0];
 if(last<2)return {old:[header],offset:0,prefixCount:0};
 // Scan only one date column across history. Read all 31 columns only from the first affected day onward.
 // Include later dates in the tail so backfills can be sorted without moving any historical prefix.
 const dates=sheet.getRange(2,1,last-1,1).getValues(),cache=new Map(),start=serialDate(p.start);
 let first=last+1,prefixCount=0;
 for(let i=0;i<dates.length;i++){
  const value=dates[i][0];if(value===''||value==null)continue;
  const key=value instanceof Date?value.getTime():String(value);
  let day=cache.get(key);if(day===undefined){try{day=serialDate(value);}catch(e){throw Error('Tanggal Daily Report tidak valid pada baris '+(i+2)+'. '+e.message);}cache.set(key,day);}
  if(day>=start){first=i+2;break;}prefixCount++;
 }
 return {old:[header,...(first<=last?sheet.getRange(first,1,last-first+1,31).getValues():[])],offset:first-2,prefixCount};
}
function dailyDelta(old,p){
 for(let j=0;j<17;j++)if(old[0]?.[j]!==DAILY_HEADERS[j])throw Error('Kolom Daily Report berubah: '+DAILY_HEADERS[j]);
 for(let j=0;j<5;j++)if(old[0]?.[26+j]!==DAILY_IDS[j])throw Error('Kolom Daily Report berubah: '+DAILY_IDS[j]);
 // Apps Script returns Date objects. Format each distinct date once, not on every identity comparison.
 const dates=new Map(),grid=old.map((r,i)=>{const out=Array.from({length:31},(_,j)=>r[j]??'');if(i&&out[0] instanceof Date){const key=out[0].getTime();if(!dates.has(key))dates.set(key,serialDate(out[0]));out[0]=dates.get(key);}return out;}),groups=new Map(),incoming=new Map();
 for(let i=1;i<grid.length;i++){
  const r=grid[i];if(!r[0])continue;
  let key;try{key=dailyBase(r);}catch(e){throw Error('Tanggal Daily Report tidak valid pada baris '+(i+1)+'. Rapikan sebelum import.');}
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
 }
 // Missing IDs may inherit a single unambiguous context, never another account's outcomes.
 for(const original of p.rows){
  const r=original.slice(),base=dailyBase(r),matches=(groups.get(base)||[]).filter(i=>{
   const oldRow=grid[i];return DAILY_IDS.every((h,j)=>!r[26+j]||!oldRow[26+j]||r[26+j]===String(oldRow[26+j]));
  });
  const contexts=new Map(matches.map(i=>[dailyContext(grid[i]),grid[i]]));
  if(contexts.size>1)throw Error('Account/ID ambigu untuk '+r[2]+' / '+r[3]+' / '+dateKey(r[0])+'. Sertakan Account Group dan ID yang sesuai.');
  if(contexts.size===1){const prior=[...contexts.values()][0];for(let j=26;j<31;j++)if(!r[j])r[j]=prior[j];if(dailyContext(r)!==dailyContext(prior))throw Error('Ada laporan lama tanpa Account/ID untuk '+r[2]+' / '+r[3]+'. Lengkapi atribusi baris lama dahulu agar tidak menggandakan hasil.');}
  const key=dailyKey(r);if(!incoming.has(key))incoming.set(key,[]);incoming.get(key).push(r);
 }
 const exact=new Map();for(const indices of groups.values())for(const i of indices){const key=dailyKey(grid[i]);if(!exact.has(key))exact.set(key,[]);exact.get(key).push(i);}
 const changes=[],fresh=[],clear=[],used=new Set();let removed=0;
 const signature=r=>JSON.stringify([dateKey(r[0]),...r.slice(1,17),...r.slice(26,31)]);
 for(const [key,rows] of incoming){
  const indices=[...(exact.get(key)||[])];
  // Assign matching rows first: extra outcomes and manually entered labels keep their own rows.
  const pending=[];for(const r of rows){const at=indices.findIndex(i=>signature(grid[i])===signature(r));if(at>=0)used.add(indices.splice(at,1)[0]);else pending.push(r);}
  for(const r of pending){
   const i=indices.length?indices.shift():grid.length;used.add(i);
   if(i===grid.length){grid.push(r.slice());fresh.push(i);}else{grid[i]=[...r.slice(0,17),...grid[i].slice(17,26),...r.slice(26,31)];}
   changes.push(i);
  }
 }
 const retainedLabels=new Map();for(const i of used){const label=dailyLabel(grid[i][21]);if(!label)continue;const key=dailyKey(grid[i]);if(!retainedLabels.has(key))retainedLabels.set(key,new Set());retainedLabels.get(key).add(label);}
 const labels=[];
 for(let i=1;i<old.length;i++){
  if(!grid[i][0]||used.has(i))continue;
  const replace=p.mode==='replace'?dateKey(grid[i][0])>=p.start&&dateKey(grid[i][0])<=p.end:incoming.has(dailyKey(grid[i]));
  if(!replace)continue;
  // Archive genuine labels that no replacement row retains. Placeholder '-' is not a message.
  const label=dailyLabel(grid[i][21]);
  if(label&&!retainedLabels.get(dailyKey(grid[i]))?.has(label))labels.push({row:i+1,cells:[dateKey(grid[i][0]),...grid[i].slice(1,4),dailyAccount(grid[i]),...grid[i].slice(27,31),label]});
  grid[i]=Array(31).fill('');clear.push(i);removed++;
 }
 return {grid,changes,fresh,clear,removed,labels,count:grid.slice(1).filter(r=>r[0]).length};
}
function dailyWriteBlocks(sheet,first,values,col){if(!values.length)return;const size=Math.min(12000,Math.max(1,Math.floor(150000/values[0].length)));for(let offset=0;offset<values.length;offset+=size)sheet.getRange(first+offset,col,Math.min(size,values.length-offset),values[0].length).setValues(values.slice(offset,offset+size));}
function archiveDailyLabels(ss,labels,job,now,journal){
 if(!labels.length)return;
 const headers=['Day','Ads Center','Adset Name','ad_name',...DAILY_IDS,'Key Messages','Archived At','Import ID','Source row before sort','Backup'];
 let sheet=ss.getSheetByName('Daily Report Labels');
 if(!sheet){sheet=ss.insertSheet('Daily Report Labels');if(sheet.getMaxColumns()>headers.length)sheet.deleteColumns(headers.length+1,sheet.getMaxColumns()-headers.length);ensureSize(sheet,1,headers.length);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);}
 const existing=sheet.getDataRange().getValues();for(let j=0;j<headers.length;j++)if(existing[0]?.[j]!==headers[j])throw Error('Schema Daily Report Labels berubah. Daily Report belum ditulis.');
 const key=r=>JSON.stringify([dateKey(r[0]),...r.slice(1,10).map(v=>String(v??''))]),seen=new Set(existing.slice(1).filter(r=>r[0]).map(key)),added=[];
 for(const item of labels){const k=key(item.cells);if(seen.has(k))continue;seen.add(k);added.push([...item.cells,now,job.requestId,item.row,journal]);}
 if(added.length){const first=sheet.getLastRow()+1;ensureSize(sheet,first+added.length-1,headers.length);sheet.getRange(first,1,added.length,10).setNumberFormat('@');dailyWriteBlocks(sheet,first,safeValues(added),1);}
}
function commitDaily(p){
 const started=Date.now(),lock=LockService.getDocumentLock();
 if(!lock.tryLock(1000)){const error=Error('Importer sedang dipakai proses lain.');error.code='IMPORT_BUSY';throw error;}
 let job=null,phase='beforeWrite';
 try{
  const id=importJobId_(p.requestId),prior=readImportJob_(id);
  if(prior){if(prior.fingerprint!==p.fingerprint||prior.source!==p.source)throw Error('Import ID tidak cocok. Preview ulang.');if(prior.state==='SUCCESS')return prior.message;throw Error('Import ID sudah diproses. Periksa status.');}
  job={requestId:id,fingerprint:p.fingerprint,source:p.source,start:p.start,end:p.end,state:'RUNNING',stage:'Reading affected Daily Report dates',started,targetSeconds:120};saveImportJob_(job);importProperties_().setProperty(IMPORT_ACTIVE,id);pruneImportJobs_();
  let stageStarted=started;const timings=[];
  const stage=s=>{const at=Date.now();timings.push(job.stage+': '+Math.round((at-stageStarted)/1000)+'s');stageStarted=at;job.stage=s;job.elapsedSeconds=Math.round((at-started)/1000);saveImportJob_(job);},ss=book(),sheet=ss.getSheetByName(DAILY_TAB);
  if(!sheet)throw Error(DAILY_TAB+' tidak ditemukan.');
  const window=dailyReadWindow(sheet,p),old=window.old,offset=window.offset,delta=dailyDelta(old,p),affected=[...delta.changes,...delta.clear],log=ss.getSheetByName('Import Log'),n=log.getLastRow()+1;
  delta.labels.forEach(label=>label.row+=offset);
  ensureSize(log,n,15);job.logRow=n;saveImportJob_(job);
  const now=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyy-MM-dd HH:mm:ss'),seconds=()=>Math.round((Date.now()-started)/1000);
  log.getRange(n,1,1,15).setValues([[now,p.source,'CSV',p.start,p.end,p.rows.length,delta.removed,'RUNNING',p.mode,'','daily-tail-v2',seconds(),'Validating changes; historical prefix left unchanged',id,p.fingerprint]]);
  let journalName='';
  if(affected.length){
   const first=affected.reduce((a,b)=>Math.min(a,b)),last=affected.reduce((a,b)=>Math.max(a,b)),count=last-first+1,existing=Math.max(0,Math.min(last+1,old.length)-first);
   stage('Backing up affected Daily Report rows');
   const forms=existing?sheet.getRange(offset+first+1,1,existing,31).getFormulas():[];
   const before=Array.from({length:count},(_,j)=>old[first+j]||Array(31).fill('')),snapshot=restoreImportValues(before,forms);
   const stamp=Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd HHmmss')+' '+Utilities.getUuid().slice(0,6),journal=ss.insertSheet('Backup Daily '+stamp);journalName=journal.getName();
   const backup=[['Row before sort','Prior cells JSON (dates tagged; formulas preserved)'],...snapshot.map((r,i)=>[offset+first+i+1,JSON.stringify(r.map(v=>v instanceof Date?{date:v.toISOString()}:v))])];
   if(backup.some(r=>String(r[1]).length>49000))throw Error('Backup row terlalu panjang; belum ada perubahan Daily Report.');
   // Keep the backup narrow; expanding a default 26-column sheet wastes workbook capacity.
   if(journal.getMaxColumns()>2)journal.deleteColumns(3,journal.getMaxColumns()-2);
   ensureSize(journal,backup.length,2);dailyWriteBlocks(journal,1,backup,1);journal.hideSheet();log.getRange(n,10).setValue(journalName);
   if(delta.labels.length){stage('Preserving Key Messages in Daily Report Labels');archiveDailyLabels(ss,delta.labels,job,now,journalName);}
   ensureSize(sheet,offset+delta.grid.length,31);
   const next=delta.grid.slice(first,last+1),write=restoreImportValues(next,forms);
   // Combine input, IDs and helpers in the same batch. Retain every untouched formula and manual label.
   for(const i of delta.changes){const input=safeValues([delta.grid[i]])[0];write[i-first].splice(0,17,...input.slice(0,17));write[i-first].splice(26,5,...input.slice(26,31));}
   for(const i of delta.clear)write[i-first]=Array(31).fill('');
   for(const i of delta.fresh){const row=offset+i+1;write[i-first][17]='=IF(A'+row+'>0,ISOWEEKNUM(A'+row+'),"")';write[i-first][18]=write[i-first][17];}
   try{
    phase='writing';stage('Writing '+p.rows.length+' Daily Report rows');
    sheet.getRange(offset+first+1,28,count,4).setNumberFormat('@');
    dailyWriteBlocks(sheet,offset+first+1,write,1);
    sheet.getRange(offset+first+1,1,count,1).setNumberFormat('yyyy-mm-dd');
    SpreadsheetApp.flush();phase='committed';
   }catch(e){
    try{dailyWriteBlocks(sheet,offset+first+1,snapshot,1);SpreadsheetApp.flush();phase='restored';log.getRange(n,8).setValue('FAILED — restored');log.getRange(n,13).setValue(String(e.message).slice(0,400));}
    catch(restoreError){throw Error('Pemulihan belum terkonfirmasi. Backup: '+journalName+'. '+restoreError.message);}
    throw Error('Daily Report dipulihkan setelah import gagal. '+e.message);
   }
   // Native row sorting carries formulas, labels and account IDs together. No rollback by old row numbers after sorting.
   stage('Sorting '+(delta.grid.length-1)+' affected rows');log.getRange(n,12,1,2).setValues([[seconds(),'Data written; sorting rows '+(offset+2)+'–'+(offset+delta.grid.length)+'. '+timings.join('; ')]]);
   sheet.getRange(offset+2,1,delta.grid.length-1,31).sort([{column:1,ascending:true},{column:3,ascending:true},{column:4,ascending:true}]);
   const filter=sheet.getFilter();if(filter)filter.remove();sheet.getRange(1,1,offset+delta.count+1,31).createFilter();sheet.setFrozenRows(1);
  }
  stage('Finalizing import');
  log.getRange(n,12,1,2).setValues([[seconds(),'Finalizing. '+timings.join('; ')]]);SpreadsheetApp.flush();
  const duration=seconds(),message='Import completed: '+p.rows.length+' baris diperiksa; '+delta.changes.length+' diperbarui, '+delta.clear.length+' baris lama diganti. '+DAILY_TAB+' berisi '+(window.prefixCount+delta.count)+' baris. '+duration+' detik.';
  log.getRange(n,8).setValue('SUCCESS');log.getRange(n,12,1,2).setValues([[duration,(affected.length?'Completed; affected dates sorted. ':'Verified: data already identical. ')+timings.join('; ')]]);
  job.state='SUCCESS';job.elapsedSeconds=duration;job.message=message;saveImportJob_(job);return message;
 }catch(error){if(job){job.state=['beforeWrite','restored'].includes(phase)?'FAILED':'UNCONFIRMED';job.message=String(error.message).slice(0,600);try{saveImportJob_(job);}catch(ignore){}}throw error;
 }finally{try{if(job&&importProperties_().getProperty(IMPORT_ACTIVE)===job.requestId)importProperties_().deleteProperty(IMPORT_ACTIVE);}finally{lock.releaseLock();}}
}
