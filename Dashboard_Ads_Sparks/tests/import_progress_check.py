from pathlib import Path
import subprocess,re,json
root=Path(__file__).resolve().parents[1]
html=(root/'import-workflow/Upload.html').read_text(encoding='utf-8')
test=(root/'tests/import-progress.js').read_text(encoding='utf-8')
html=html.replace('</body>','<script>try{'+test+'}catch(e){const errorNode=document.createElement("pre");errorNode.id="test-error";errorNode.textContent=e.stack;document.body.appendChild(errorNode);}</script></body>')
path=root/'.work/import-progress-test.html';path.write_text(html,encoding='utf-8')
proc=subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--no-first-run','--no-default-browser-check','--user-data-dir='+str(root/'.work/chrome-import-progress'),'--dump-dom',path.as_uri()],capture_output=True,text=True,encoding='utf-8',timeout=45)
m=re.search(r'<pre id="test-result">(\[.*?\])</pre>',proc.stdout,re.S)
if not m:
 print(proc.stdout[-2500:]);raise AssertionError('UI tests failed')
checks=json.loads(m.group(1));print(json.dumps(checks));assert all(c['ok'] for c in checks)
script=(root/'import-workflow/SparksImport.gs').read_text(encoding='utf-8');start=script.index('const UPLOAD_HTML=')+len('const UPLOAD_HTML=');embedded,_=json.JSONDecoder().raw_decode(script[start:]);assert embedded==(root/'import-workflow/Upload.html').read_text(encoding='utf-8')
print('Embedded Apps Script dialog matches tested source.')
