"""Embed the dialog and regenerate the copy-script helper from canonical sources."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parent
ui=root/'Upload.html'
h=ui.read_text(encoding='utf-8');start=h.index('<script>')+len('<script>');end=h.index('</script>',start)
ui.write_text(h[:start]+'\n'+(root/'UploadClient.js').read_text(encoding='utf-8')+'\n'+h[end:],encoding='utf-8')
script=root/'SparksImport.gs'
s=script.read_text(encoding='utf-8')
s=re.sub(r'^function uploadCsv\(.*?\n','',s,flags=re.M)
a=s.index('/* Bundled into SparksImport.gs') if '/* Bundled into SparksImport.gs' in s else s.index('function commit(p){')
b=s.index('function refreshMetrics()',a)
helpers=(root/'FastCommit.js').read_text(encoding='utf-8').split('function commit(p){')[0]
s=s[:a]+helpers+(root/'ImportStatus.js').read_text(encoding='utf-8')+'\n'+(root/'DeltaCommit.js').read_text(encoding='utf-8')+'\n'+(root/'DailyImport.js').read_text(encoding='utf-8')+'\n'+s[b:]
a=s.index('const UPLOAD_HTML=');b=s.index('\nconst FORMULAS',a)
s=s[:a]+'const UPLOAD_HTML='+json.dumps((root/'Upload.html').read_text(encoding='utf-8'),ensure_ascii=False)+';\n'+s[b:]
script.write_text(s,encoding='utf-8')
p=root/'Activate-Import.html';h=p.read_text(encoding='utf-8');a=h.index('const code=')+len('const code=');_,n=json.JSONDecoder().raw_decode(h[a:])
h=h[:a]+json.dumps(s,ensure_ascii=False).replace('</','<\\/')+h[a+n:];p.write_text(h,encoding='utf-8')
