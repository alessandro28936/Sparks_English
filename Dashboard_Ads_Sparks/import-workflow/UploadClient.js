let text='',token='',requestId='',busy=false,timer=null,pollTimer=null,checking=false,started=0,stage='idle',submissionPending=false;
const el=id=>document.getElementById(id);
let metaCached=false;
async function metaCsvPayload(file,plain){
 if(file.size<250000||typeof CompressionStream==='undefined')return plain;
 try{
  const bytes=new Uint8Array(await new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const chunks=[];
  for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
  const packed='gzip64:'+btoa(chunks.join(''));return packed.length<plain.length?packed:plain;
 }catch(ignore){return plain;}
}
function lock(value){busy=value;document.querySelectorAll('input,select').forEach(e=>e.disabled=value);el('preview').disabled=value;el('apply').disabled=value||!token;el('status').setAttribute('aria-busy',String(value));}
function show(kind,title,details,hint=''){el('status').className='status '+kind;el('heading').textContent=title;el('details').textContent=details;el('hint').textContent=hint;el('check').hidden=!requestId||['idle','read','preview','success'].includes(stage);}
function tick(){const seconds=Math.floor((Date.now()-started)/1000);el('elapsed').textContent='Elapsed: '+Math.floor(seconds/60)+'m '+seconds%60+'s';if(stage==='import'&&seconds>=360)el('hint').textContent='Menunggu konfirmasi Import ID ini. Jangan impor ulang. Status diperiksa otomatis; jika tetap belum selesai, periksa Apps Script → Executions.';else if(stage==='import'&&el('source').value==='Daily Report'&&seconds>=120)el('hint').textContent='Target 2 menit terlewati. Proses belum dikonfirmasi selesai; tahap terakhir ditampilkan di atas. Jangan impor ulang selama proses berjalan.';}
function begin(next,title,description){stage=next;started=Date.now();clearInterval(timer);lock(true);show('',title,description);el('progress').hidden=false;el('progress').removeAttribute('value');el('elapsed').hidden=false;tick();timer=setInterval(tick,1000);}
function stop(){clearInterval(timer);clearTimeout(pollTimer);timer=null;pollTimer=null;lock(false);}
function sourceHelp(){
 const source=el('source').value,daily=source==='Daily Report',slsa=source==='SLSA Daily Report';
 el('title').textContent=slsa?'Import SLSA Daily Report':daily?'Import Daily Report':'Import Meta Ads';
 el('intro').textContent=slsa?'Upload CSV lengkap SLSA - Meta untuk tanggal Leads Submitted yang dipilih. Tanggal dapat diambil dari file jika isian kosong.':daily?'Upload export harian dengan calendar_date. Data mulai 1 Juli 2026.':'Upload CSV export Meta dengan breakdown Day.';
 el('destination').textContent=slsa?'Destination: SLSA Daily Report → Leads / Booking dashboard.':daily?'Destination: Copy of Daily Report → Leads / Booking dashboard.':'Destination: Raw Data → Dashboard. Tab Import hanya untuk paste manual.';
 const mode=el('mode');
 if(!slsa&&mode.options[0].disabled)mode.value='upsert';
 mode.options[0].disabled=slsa;
 if(slsa)mode.value='replace';
 mode.options[0].textContent=daily?'Update ad / dates in file':'Update ads in file';
 mode.options[1].textContent=slsa?'Replace submitted dates':daily?'Replace all centers / date range':'Replace complete source / date range';
}
function changed(){if(busy)return;stop();sourceHelp();requestId='';token='';stage='idle';el('apply').disabled=true;el('progress').hidden=true;el('elapsed').hidden=true;show('','Ready to preview','Pilihan berubah. Klik Preview untuk memeriksa file.');}
document.querySelectorAll('input,select').forEach(e=>e.addEventListener('change',changed));
sourceHelp();
function completed(r){
 tick();
 token='';submissionPending=false;stop();stage='success';el('progress').hidden=false;el('progress').value=100;
 show('success','✓ Import completed · 100%',r.message||'Data tersimpan.',`Import ID: ${requestId}. SUCCESS terkonfirmasi untuk impor ini. Anda boleh menutup jendela atau mengimpor account berikutnya.`);
}
function scheduleCheck(delay=5000){clearTimeout(pollTimer);if(['import','busy','checking'].includes(stage))pollTimer=setTimeout(()=>checkStatus(),delay);}
function receiveStatus(r){
 if(!r||r.requestId!==requestId||stage==='success')return;
 if(r.state==='SUCCESS'&&r.done===true){completed(r);return;}
 if(r.state==='FAILED'){token='';submissionPending=false;stop();stage='error';el('progress').hidden=true;show('error','Import failed',r.message||'Periksa Import Log.',`Import ID: ${requestId}`);return;}
 if(stage==='busy'&&!submissionPending&&r.ready&&r.state==='NOT_STARTED'){
  stop();stage='preview';el('progress').hidden=true;show('','Ready to import','Importer sudah tersedia. File ini belum diimpor.','Klik Import untuk melanjutkan; Preview sebelumnya tetap valid.');return;
 }
 if(r.state==='RUNNING'){
  stage='import';lock(true);show('','Import in progress',r.stage||'Server sedang memproses impor.',`Import ID: ${requestId}`);scheduleCheck();return;
 }
 if(r.state==='UNCONFIRMED'||(!submissionPending&&stage==='checking'&&r.state==='NOT_STARTED')){
  token='';stop();stage='unconfirmed';el('progress').hidden=true;show('warning','Status needs checking',r.message||'Belum ada konfirmasi untuk Import ID ini.','Gunakan Check status atau periksa Import Log / Executions sebelum mengulang.');return;
 }
 if(r.state==='BUSY')show('warning',submissionPending?'Waiting for importer':'Importer busy',r.activeSource?`Proses ${r.activeSource} sedang memakai importer.`:'Importer sedang dipakai proses lain.',submissionPending?'Permintaan sedang diperiksa.': 'File ini belum diimpor. Menunggu importer tersedia; tidak ada penulisan ulang otomatis.');
 scheduleCheck();
}
function checkStatus(){
 if(!requestId||checking||stage==='success')return;const id=requestId;checking=true;el('check').disabled=true;
 google.script.run.withSuccessHandler(r=>{checking=false;el('check').disabled=false;if(id===requestId)receiveStatus(r);})
 .withFailureHandler(e=>{checking=false;el('check').disabled=false;if(id!==requestId||stage==='success')return;el('hint').textContent='Pengecekan status belum terhubung. Gunakan Check status atau periksa Import Log / Executions. Import ID: '+id;scheduleCheck(10000);}).getImportStatus(id);
}
function failed(error,importing){
 const message=error&&error.message?error.message:String(error);
 if(importing&&requestId){submissionPending=false;stage='checking';lock(true);show('warning','Checking import status',message,'Memastikan hasil berdasarkan Import ID, bukan catatan sukses account lain.');checkStatus();scheduleCheck();return;}
 token='';stop();stage='error';el('progress').hidden=true;show('error','Preview failed',message,'Perbaiki file atau pilihan, lalu klik Preview lagi.');
}
function request(confirm){
 const importing=!!confirm,id=requestId;if(importing)submissionPending=true;
 const rpc=google.script.run.withSuccessHandler(r=>{
  if(id!==requestId||stage==='success')return;
  if(importing){if(r?.needsFile&&metaCached&&r.requestId===id){metaCached=false;request(confirm);return;}submissionPending=false;if(r?.state==='BUSY'){stage='busy';lock(true);receiveStatus(r);return;}if(r?.done===true&&r.requestId===id){completed(r);return;}failed(new Error('Server belum mengonfirmasi hasil impor ini.'),true);}
  else{token=r.token||'';requestId=r.requestId||'';stop();stage='preview';el('apply').disabled=!token||!requestId;el('progress').hidden=true;show('','Preview ready — not imported yet',r.summary||'Tidak ada ringkasan.','Klik Import untuk menyimpan.');}
  if(!importing)metaCached=r.cached===true;
 }).withFailureHandler(e=>{if(id===requestId&&stage!=='success')failed(e,importing);});
 const source=el('source').value,opts=[el('mode').value,el('start').value,el('end').value,confirm,id];
 if(importing&&metaCached)rpc.uploadCachedMetaCsv(source,...opts);else rpc.uploadCsv(source,text,...opts);
}
function preview(){
 if(busy)return;const file=el('file').files[0];if(!file){show('error','Choose a CSV file','Pilih file sebelum klik Preview.');return;}if(file.size>10000000){failed(new Error('File terlalu besar; bagi menjadi rentang tanggal lebih pendek.'),false);return;}
 token='';requestId='';begin('read','Reading file','Membaca '+file.name);const reader=new FileReader();
 reader.onprogress=e=>{if(e.lengthComputable){el('progress').value=e.loaded/e.total*100;el('heading').textContent='Reading file · '+Math.round(e.loaded/e.total*100)+'%';}};
 reader.onerror=()=>failed(new Error('File tidak dapat dibaca. Pilih file kembali.'),false);reader.onabort=()=>failed(new Error('Pembacaan file dibatalkan.'),false);
 reader.onload=async()=>{text=reader.result;metaCached=false;if(!el('source').value.endsWith('Daily Report')&&file.size>=250000)text=await metaCsvPayload(file,text);stage='preview';el('progress').removeAttribute('value');show('','Validating file','Memeriksa format, tanggal, dan identitas ad.');request('');};reader.readAsText(file);
}
function apply(){if(busy||!token||!requestId)return;begin('import','Import in progress','Memvalidasi dan menyimpan perubahan.');request(token);scheduleCheck();}
