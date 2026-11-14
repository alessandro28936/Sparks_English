const checks=[];function check(name,ok){checks.push({name,ok:!!ok});if(!ok)throw Error(name);}
function rejects(fn,part){try{fn();return false}catch(e){return String(e.message).includes(part)}}
let dateFormats=0;
const Utilities={formatDate(d,tz,fmt){dateFormats++;return d.toISOString().slice(0,10)},base64Encode(x){return String(x)},computeDigest(a,s){let n=0;for(const c of s)n=(Math.imul(n,31)+c.charCodeAt(0))|0;return n},DigestAlgorithm:{SHA_256:'SHA'},getUuid(){return 'test-'+Math.random().toString(36).slice(2)},parseCsv(){return csv}};
const plan=prepareDaily(csv,'upsert','','');
check('Real CSV: 6262 rows, November 1–10',plan.rows.length===6262&&plan.start==='2026-11-01'&&plan.end==='2026-11-10');
const sum=(rows,j)=>rows.reduce((s,r)=>s+Number(r[j]||0),0);
check('Real CSV totals preserved',sum(plan.rows,14)===19119&&sum(plan.rows,11)===1403&&sum(plan.rows,15)===21403&&sum(plan.rows,8)===515722453);
check('Undefined ratio stays blank',plan.rows[0][10]==='');
const headers=[...DAILY_HEADERS,'Week_num','ISO_Week','UNSPEC TAG','KV-Sources','Key Messages','Campaign Type','Cluster Name','Cleaned Adset Name','',...DAILY_IDS];
const first=plan.rows.find(r=>r[14]>0),row=first.slice(),different=first.slice();different[2]='OTHER_SET';
function p(rows,mode='upsert'){return {...plan,rows,mode,requestId:'test-request-'+Math.random().toString(36).slice(2)}}
let d=dailyDelta([headers,row,different],p([row]));
check('Identical upload has no changes',d.changes.length===0&&d.clear.length===0);
const changed=row.slice();changed[14]+=5;
d=dailyDelta([headers,row,different],p([changed]));
check('Updates only matching center/set/ad/date',d.grid[1][14]===changed[14]&&d.grid[2][14]===different[14]&&d.count===2);
const dup=dailyDelta([headers],p([row,row]));
check('Duplicate report rows are additive',dup.count===2&&sum(dup.grid.slice(1),14)===2*row[14]);
check('Re-upload does not append duplicates',dailyDelta(dup.grid,p([row,row])).changes.length===0);
const one=dailyDelta(dup.grid,p([changed]));check('Upsert replaces whole group not appends',one.count===1&&sum(one.grid.slice(1),14)===changed[14]);
const center=row.slice();center[1]='OTHER_CENTER';
check('Same names in other centers preserved',dailyDelta([headers,row,center],p([changed])).grid[2][14]===center[14]);
const second=row.slice();second[0]+=1;
check('Dates are isolated',dailyDelta([headers,row,second],p([changed])).grid[2][14]===second[14]);
const main=row.slice(),secondary=row.slice();main[26]='Main';secondary[26]='Secondary';
check('Missing account does not join multiple accounts',rejects(()=>dailyDelta([headers,main,secondary],p([changed])),'ambigu'));
const explicit=changed.slice();explicit[26]='Main';
check('Explicit Main leaves Secondary untouched',dailyDelta([headers,main,secondary],p([explicit])).grid[2][14]===secondary[14]);
const idRow=row.slice();idRow[26]='Main';idRow[27]='123';idRow[30]='999999999999999999';
check('Omitted IDs inherit unique context',dailyDelta([headers,idRow],p([changed])).grid[1][30]===idRow[30]);
check('Unconfirmed ID upgrade cannot duplicate history',rejects(()=>dailyDelta([headers,row],p([idRow])),'atribusi'));
const manual=row.slice();manual[21]='Important key message';
check('Manual message survives update',dailyDelta([headers,manual],p([changed])).grid[1][21]===manual[21]);
const removedLabel=dailyDelta([headers,manual],p([different],'replace'));
check('Replaced manual message is queued for preservation',removedLabel.labels.length===1&&removedLabel.labels[0].cells[9]==='Important key message');
const placeholder=manual.slice();placeholder[21]='-';check('Dash placeholder does not block or archive',dailyDelta([headers,placeholder],p([different],'replace')).labels.length===0);
check('Error and blank label placeholders ignored',dailyLabel('#REF!')===''&&dailyLabel("'-")===''&&dailyLabel(' — ')===''&&dailyLabel('N/A')==='');
check('Replace removes absent rows inside range',dailyDelta([headers,row,different],p([changed],'replace')).count===1);
const older=row.slice();older[0]=serialDate('2026-10-01');
check('Replace retains history outside range',dailyDelta([headers,older,row],p([changed],'replace')).grid[1][0]===older[0]);
const input=csv[1].slice();input[0]='2026-06-30';
check('Pre-July imports blocked',rejects(()=>prepareDaily([csv[0],input],'upsert','',''),'1 Juli'));
const weekly=csv[0].slice();weekly[0]='Week';check('Week-only export rejected clearly',rejects(()=>prepareDaily([weekly,csv[1]],'upsert','',''),'breakdown harian'));
input[0]='2026-11-31';check('Invalid day rejected',rejects(()=>prepareDaily([csv[0],input],'upsert','',''),'Tanggal'));
input[0]='2026-11-01';input[14]='';check('Missing Leads never becomes zero',rejects(()=>prepareDaily([csv[0],input],'upsert','',''),'Leads kosong'));
input[14]='1.5';check('Fractional counts rejected',rejects(()=>prepareDaily([csv[0],input],'upsert','',''),'bilangan bulat'));
input[14]='-1';check('Negative counts rejected',rejects(()=>prepareDaily([csv[0],input],'upsert','',''),'Angka tidak valid'));
input[14]='1';input[13]="'25%";check('Percent string normalized',prepareDaily([csv[0],input],'upsert','','').rows[0][13]===.25);
input[2]='CL.JU_T_D_W_TA';input[3]='VEXTR_30/';input[0]='2026-11-09';
check('Confirmed typo correction survives re-import',prepareDaily([csv[0],input],'upsert','','').rows[0][3]==='VEXTR_30');
input[0]='2026-11-08';check('Typo correction does not generalize dates',prepareDaily([csv[0],input],'upsert','','').rows[0][3]==='VEXTR_30/');
// Spreadsheet mock exercises the write path, lock, backup, failure recovery and exact-request completion.
let writes=0,locked=false,failWrite=false,failSort=false,rangeReads=[],sortRanges=[],dataWrites=[];
const properties=new Map();const PropertiesService={getDocumentProperties(){return {getProperty:k=>properties.get(k)||null,setProperty(k,v){properties.set(k,v)},deleteProperty:k=>properties.delete(k),getProperties:()=>Object.fromEntries(properties)}}};
const LockService={getDocumentLock(){return {tryLock(){if(locked)return false;locked=true;return true},releaseLock(){locked=false}}}};
class Sheet{
 constructor(name,values=[]){this.name=name;this.values=values.map(r=>r.slice());this.rows=Math.max(1000,values.length);this.cols=26;this.filter=null;}
 getName(){return this.name}getMaxRows(){return this.rows}getMaxColumns(){return Math.max(this.cols,...this.values.map(r=>r.length))}getLastRow(){return this.values.length}
 insertRowsAfter(n,count){this.rows+=count}insertColumnsAfter(n,count){this.cols+=count}deleteColumns(start,count){this.cols-=count}hideSheet(){}setFrozenRows(){}
 getDataRange(){return this.getRange(1,1,Math.max(1,this.values.length),this.getMaxColumns())}getFilter(){return this.filter}
 getRange(row,col,height=1,width=1){const self=this;return {
  getValues(){rangeReads.push({sheet:self.name,row,col,height,width});return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>self.values[row+i-1]?.[col+j-1]??''))},
  getFormulas(){return this.getValues().map(r=>r.map(v=>typeof v==='string'&&v.startsWith('=')?v:''))},
  setValues(data){writes++;dataWrites.push({sheet:self.name,row,col,height,width});if(failWrite&&self.name===DAILY_TAB){failWrite=false;throw Error('Injected write failure')}for(let i=0;i<height;i++){self.values[row+i-1]??=[];for(let j=0;j<width;j++)self.values[row+i-1][col+j-1]=data[i][j]}return this},
  setValue(v){return this.setValues([[v]])},setNumberFormat(){return this},setFormulas(data){return this.setValues(data)},
  clearContent(){return this.setValues(Array.from({length:height},()=>Array(width).fill('')))},
  sort(){sortRanges.push({sheet:self.name,row,height});if(failSort)throw Error('Injected sort failure');const rows=self.values.slice(row-1,row-1+height);rows.sort((a,b)=>!a[0]?1:!b[0]?-1:serialDate(a[0])-serialDate(b[0])||String(a[2]).localeCompare(String(b[2]))||String(a[3]).localeCompare(String(b[3])));self.values.splice(row-1,height,...rows)},
  createFilter(){self.filter={remove(){self.filter=null}}}
 }}
}
let sheets;const SpreadsheetApp={getActiveSpreadsheet(){return {getId:()=>SPARKS_ID,getSheetByName:n=>sheets.get(n),insertSheet(n){const s=new Sheet(n);sheets.set(n,s);return s}}},flush(){}};
function reset(rows){properties.clear();writes=0;rangeReads=[];sortRanges=[];dataWrites=[];failWrite=failSort=locked=false;sheets=new Map([[DAILY_TAB,new Sheet(DAILY_TAB,rows)],['Import Log',new Sheet('Import Log',[Array(15).fill('')])]]);}
reset([headers,older,row]);let job=p([changed]);let result=commitDaily(job);
check('Commit writes and confirms exact job',result.startsWith('Import completed')&&getImportStatus(job.requestId).state==='SUCCESS');
check('Commit creates backup and updates existing outcomes',sheets.size===3&&sum(sheets.get(DAILY_TAB).values.slice(1),14)===older[14]+changed[14]);
const priorWrites=writes;commitDaily(job);check('Same request ID cannot write twice',writes===priorWrites);
const noop=p([changed]);commitDaily(noop);check('Identical export skips Daily Report backup',sheets.size===3);
reset([headers,row]);job=p([changed]);failWrite=true;
check('Write exception triggers restoration',rejects(()=>commitDaily(job),'dipulihkan')&&sheets.get(DAILY_TAB).values[1][14]===row[14]&&getImportStatus(job.requestId).state==='FAILED');
reset([headers,row]);job=p([changed]);failSort=true;
check('Sort failure never reports false success',rejects(()=>commitDaily(job),'sort failure')&&getImportStatus(job.requestId).state==='UNCONFIRMED');
reset([headers]);job=p(plan.rows);commitDaily(job);
check('Actual CSV commit retains all totals',sum(sheets.get(DAILY_TAB).values.slice(1),14)===19119&&sum(sheets.get(DAILY_TAB).values.slice(1),11)===1403);
check('Bulk writes avoid per-row spreadsheet calls',writes<45);
const realWrites=writes;commitDaily({...job,requestId:'another-real-request'});
check('Real CSV repeat does not add rows',sheets.get(DAILY_TAB).values.length===6263&&sheets.size===3);
const liveOld=[headers,...live.map(r=>Array.from({length:31},(_,j)=>r[j]??''))];
reset(liveOld);const approvedPreview=uploadCsv('Daily Report','sample','upsert','','','','');
check('Real CSV preview accepts the approved replacement without writing',approvedPreview.token&&approvedPreview.requestId&&writes===0);
const ld=dailyDelta(liveOld,plan),incomingKeys=new Set(plan.rows.map(dailyKey));
const expected=liveOld.slice(1).filter(r=>!incomingKeys.has(dailyKey(r)));
check('Latest CSV totals replace prior additional results',sum(ld.grid.slice(1),14)===sum(expected,14)+19119&&sum(ld.grid.slice(1),11)===sum(expected,11)+1403);
const selected=(rows,ad)=>rows.filter(r=>r[0]&&dateKey(r[0])==='2026-11-01'&&r[2]==='CL.JU_T_D_W_TA'&&r[3]===ad);
for(const ad of ['ITRY_1','OLD_10'])check(ad+': 6 old Leads become exactly 3 from CSV',sum(selected(liveOld.slice(1),ad),14)===6&&sum(selected(ld.grid.slice(1),ad),14)===3&&selected(ld.grid.slice(1),ad).length===1);
const historical=row.slice();historical[0]=serialDate('2026-10-20');historical[2]='BGR_T_D_W_TA';historical[3]='OLD_12';historical[14]=1;
const withHistory=dailyDelta([headers,historical,historical,...liveOld.slice(1)],plan);
check('Additional October rows remain outside November update',withHistory.grid.filter(r=>r[0]===historical[0]&&r[3]==='OLD_12').length===2);
check('Real sheet snapshot: other report rows unchanged',expected.every(r=>ld.grid.some(x=>JSON.stringify(x)===JSON.stringify(r))));
const ldRepeat=dailyDelta(ld.grid,plan);check('Real sheet snapshot: second import is a no-op',ldRepeat.changes.length===0&&ldRepeat.clear.length===0);
reset(liveOld);commitDaily(p(plan.rows));
check('Real sheet snapshot: bulk writer preserves latest CSV totals',sum(sheets.get(DAILY_TAB).values.slice(1),14)===sum(expected,14)+19119&&sum(sheets.get(DAILY_TAB).values.slice(1),11)===sum(expected,11)+1403);
const commitWrites=writes;reset([headers]);const dailyPreviewResult=uploadCsv('Daily Report','sample','upsert','','','','');
check('Daily Report routing returns an inspected preview without writes',dailyPreviewResult.summary.includes('6262')&&dailyPreviewResult.requestId&&writes===0);
const latest=prepareDaily(csvNew,'replace','2026-11-01','2026-11-11');
check('New CSV contains 6261 rows through November 10',latest.rows.length===6261&&latest.fileEnd==='2026-11-10');
check('Preview warns about selected November 11 outside file',dailySummary(latest).includes('CSV hanya mencakup 2026-11-01 s.d. 2026-11-10'));
const datedLive=liveOld.map((r,i)=>{const copy=r.slice();if(i)copy[0]=new Date(Date.UTC(1899,11,30)+Number(r[0])*86400000);return copy});
dateFormats=0;const latestDelta=dailyDelta(datedLive,latest),formatted=dateFormats;
check('Date formatting occurs once per day, not once per comparison',formatted===10);
check('New replacement reproduces exact file totals',latestDelta.count===6261&&sum(latestDelta.grid.slice(1),14)===19093&&sum(latestDelta.grid.slice(1),11)===1402&&sum(latestDelta.grid.slice(1),8)===515722453);
check('Real labels removed by replacement are preserved',latestDelta.labels.length>0&&latestDelta.labels.every(x=>x.cells[9]!=='-'));
reset(datedLive);const latestJob={...latest,requestId:'latest-csv-replace-test'};commitDaily(latestJob);
const labelSheet=sheets.get('Daily Report Labels');
check('Commit archives genuine labels in a separate visible sheet',labelSheet&&labelSheet.values.length>1&&labelSheet.values.slice(1).every(r=>r[9]!=='-'));
check('Archive never changes results or outcomes',sum(sheets.get(DAILY_TAB).values.slice(1),14)===19093&&sum(sheets.get(DAILY_TAB).values.slice(1),11)===1402);
check('Replacement helper writes are batched',writes<60);
const archiveRows=labelSheet.values.length,newWrites=writes;commitDaily({...latestJob,requestId:'repeat-new-csv-test'});
check('Re-import duplicates neither metrics nor archived labels',labelSheet.values.length===archiveRows&&sheets.get(DAILY_TAB).values.slice(1).filter(r=>r[0]).length===6261);
reset([headers,manual]);failWrite=true;check('Write failure restores labels and outcomes after archival',rejects(()=>commitDaily(p([different],'replace')),'dipulihkan')&&sheets.get(DAILY_TAB).values[1][21]==='Important key message'&&sheets.get('Daily Report Labels').values[1][9]==='Important key message');
const prefix=Array.from({length:50000},()=>older.slice()),large=[headers,...prefix,...liveOld.slice(1)];
reset(large);const window=dailyReadWindow(sheets.get(DAILY_TAB),latest);
check('Large history reads only dates plus affected 31-column tail',window.offset===50000&&window.old.length===7451&&window.prefixCount===50000&&rangeReads.every(r=>r.width===1||r.height===1||r.row>=50002));
const previewCells=rangeReads.filter(r=>r.sheet===DAILY_TAB).reduce((s,r)=>s+r.height*r.width,0);
check('Large history read volume reduced by more than 80 percent',previewCells<large.length*31*.2);
const largeJob={...latest,requestId:'large-history-import'};commitDaily(largeJob);
const output=sheets.get(DAILY_TAB).values;
check('50k historical rows retain all original cells',output.slice(1,50001).every((r,i)=>JSON.stringify(r)===JSON.stringify(prefix[i])));
check('Only the affected tail is sorted',sortRanges.length===1&&sortRanges[0].row===50002&&sortRanges[0].height<8000);
check('No input writes touch the historical prefix',dataWrites.filter(r=>r.sheet===DAILY_TAB).every(r=>r.row>=50002));
check('Total count includes untouched prefix',readImportJob_(largeJob.requestId).message.includes('56261 baris'));
const journal=[...sheets.values()].find(s=>s.name.startsWith('Backup Daily'));
check('Backup uses actual sheet row numbers after offset',journal.values[1][0]>=50002);
const archive=sheets.get('Daily Report Labels');check('Archived labels retain actual source row numbers',archive.values.slice(1).every(r=>r[12]>=50002));
check('Stage durations persist in final log',sheets.get('Import Log').values[1][12].includes('Reading affected Daily Report dates:')&&readImportJob_(largeJob.requestId).targetSeconds===120);
const largeSorted=sortRanges[0].height;
reset([headers,older]);const appendJob=p([row]);commitDaily(appendJob);
check('Append after latest date sorts only appended rows',sortRanges[0].row===3&&sortRanges[0].height===1&&sheets.get(DAILY_TAB).values[2][17].includes('A3'));
const future=row.slice();future[0]=serialDate('2026-11-20');reset([headers,older,row,future]);commitDaily(p([changed]));
check('Backfill preserves future rows while sorting affected tail',sheets.get(DAILY_TAB).values.some(r=>r[0]===future[0]&&r[14]===future[14])&&sortRanges[0].row===3);
reset([headers,older,row]);failWrite=true;
check('Rollback with prefix restores actual row rather than shifted position',rejects(()=>commitDaily(p([changed])),'dipulihkan')&&JSON.stringify(sheets.get(DAILY_TAB).values[1])===JSON.stringify(older)&&sheets.get(DAILY_TAB).values[2][14]===row[14]);
return {checks,bulkWrites:realWrites,largeHistory:{totalRows:large.length-1,sortedRows:largeSorted,previewCells,previousReadCells:large.length*31},latest:{rows:latest.rows.length,leads:19093,booking:1402,labelRows:archiveRows-1,writes:newWrites,dateFormats:formatted},live:{changed:ld.changes.length,cleared:ld.clear.length,after:ld.count,writes:commitWrites},sample:{rows:plan.rows.length,start:plan.start,end:plan.end,leads:sum(plan.rows,14),booking:sum(plan.rows,11)}};
