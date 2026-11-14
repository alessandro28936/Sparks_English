from pathlib import Path
import csv,json,re,subprocess
root=Path(__file__).resolve().parents[1]
with Path(r'C:\Users\aless\Downloads\EDU-SE-Main.csv').open(encoding='utf-8-sig',newline='') as f:data=list(csv.reader(f))
live=json.loads((root/'.work/raw-before-delta.json').read_text(encoding='utf-8'))
test=(root/'tests/import-delta.js').read_text(encoding='utf-8')
old=(root/'tests/import-fast.js').read_text(encoding='utf-8');mock=old[old.index('let writes='):old.index('reset([headers]);const result=')]
mock=mock.replace('let writes=0,','let formulaWrites=0,writes=0,').replace('setNumberFormat(){return this},','setNumberFormat(){return this},setFormulas(data){formulaWrites++;return this.setValues(data)},')
mock=mock.replace('writes=copyCalls=flushes=0;', 'propertyData.clear();formulaWrites=writes=copyCalls=flushes=0;')
test=test.replace('// MOCK_SHEETS',mock)
code=(root/'import-workflow/SparksImport.gs').read_text(encoding='utf-8')+'\n'+test
payload=json.dumps(code).replace('</','<\\/')
body='try{document.getElementById("result").textContent=JSON.stringify(new Function("csv","live",'+payload+')('+json.dumps(data)+','+json.dumps(live)+'));}catch(e){document.getElementById("result").textContent="FAIL "+e.stack;}'
page=root/'.work/import-delta-test.html';page.write_text('<html><body><pre id="result">pending</pre><script>'+body+'</script></body></html>',encoding='utf-8')
proc=subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+str(root/'.work/chrome-delta-import'),'--dump-dom',page.as_uri()],capture_output=True,text=True,encoding='utf-8',timeout=90)
m=re.search(r'<pre id="result">(.*?)</pre>',proc.stdout,re.S);print(m.group(1) if m else proc.stderr[-1500:]);assert m and m.group(1).startswith('{')
result=json.loads(m.group(1));assert all(c['ok'] for c in result['checks']);(root/'.work/import-delta-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
