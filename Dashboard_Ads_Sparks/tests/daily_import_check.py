from pathlib import Path
import csv,json,re,subprocess,html
root=Path(__file__).resolve().parents[1]
with Path(r'C:\Users\aless\Downloads\20261112_032325.csv').open(encoding='utf-8-sig',newline='') as f:data=list(csv.reader(f))
with Path(r'C:\Users\aless\Downloads\20261112_083825.csv').open(encoding='utf-8-sig',newline='') as f:new_data=list(csv.reader(f))
code=(root/'import-workflow/SparksImport.gs').read_text(encoding='utf-8')+'\n'+(root/'tests/daily-import.js').read_text(encoding='utf-8')
live=json.loads((root/'.work/daily-cleanup/november-before-import.json').read_text(encoding='utf-8'))
payload=json.dumps(code).replace('</','<\\/')
body='try{document.getElementById("result").textContent=JSON.stringify(new Function("csv","live","csvNew",'+payload+')('+json.dumps(data)+','+json.dumps(live)+','+json.dumps(new_data)+'));}catch(e){document.getElementById("result").textContent="FAIL "+e.stack;}'
page=root/'.work/daily-import-test.html';page.write_text('<html><body><pre id="result">pending</pre><script>'+body+'</script></body></html>',encoding='utf-8')
proc=subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+str(root/'.work/chrome-daily-import'),'--dump-dom',page.as_uri()],capture_output=True,text=True,encoding='utf-8',timeout=60)
m=re.search(r'<pre id="result">(.*?)</pre>',proc.stdout,re.S)
value=html.unescape(m.group(1)) if m else proc.stderr[-1500:]
print(value);assert m and value.startswith('{')
result=json.loads(value);assert all(c['ok'] for c in result['checks'])
(root/'.work/daily-import-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
