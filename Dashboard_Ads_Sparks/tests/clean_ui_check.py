"""Local Chromium QA via DevTools. Uses installed Chrome; no user browser profile."""
import asyncio
import base64
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import websockets

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(os.environ.get('PROGRAMFILES', r'C:\Program Files')) / 'Google/Chrome/Application/chrome.exe'
WORK = ROOT / '.work'

async def run():
    WORK.mkdir(exist_ok=True)
    server = subprocess.Popen(['python', '-m', 'http.server', '8813', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9273', '--remote-allow-origins=http://localhost:9273', '--user-data-dir='+str(WORK/'chrome-summary-focused'), '--window-size=1512,1100', 'http://127.0.0.1:8813/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9273/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9273') as ws:
            async def call(method, params=None):
                nonlocal counter
                counter += 1
                seq = counter
                await ws.send(json.dumps({'id': seq, 'method': method, 'params':params or {}}))
                while True:
                    data=json.loads(await ws.recv())
                    if data.get('method')=='Runtime.exceptionThrown':errors.append(data['params'])
                    if data.get('id')==seq:
                        if 'error' in data: raise RuntimeError(data['error'])
                        return data.get('result',{})
            async def js(expression):
                res=await call('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True})
                if 'exceptionDetails' in res:raise RuntimeError(res['exceptionDetails'])
                return res.get('result',{}).get('value')
            await call('Runtime.enable')
            await call('Page.enable')
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and (status['loaded'] or not status['busy']):break
                await asyncio.sleep(.5)
            print('SYNC',json.dumps(status),flush=True)
            assert status and status['loaded'],status
            for name in ['whatsapp-ui','overview-audit','report-summary','adsets','period-learning','rules']:
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                print(name, json.dumps({'passed': sum(1 for c in (result['checks'] if isinstance(result,dict) else result) if c['ok']), 'details': {k:v for k,v in result.items() if k!='checks'} if isinstance(result,dict) else {}}),flush=True)
                checks=result['checks'] if isinstance(result,dict) else result
                assert all(c['ok'] for c in checks)
            await js("$('objectiveFilter').value='ALL';setWorkView('all');periodValuesOpen=true;navigate('overview')")
            for width in [1600,1000,390]:
                await call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1100,'deviceScaleFactor':1,'mobile':width<500})
                await js("document.querySelector('.filter-panel').scrollIntoView({block:'start'})")
                layout=await js("(()=>{const p=document.querySelector('.filter-panel').getBoundingClientRect();return [...document.querySelectorAll('.work-view-row button,.filters select')].every(e=>{const r=e.getBoundingClientRect();return r.left>=p.left+10 && r.right<=p.right-10;});})()")
                assert layout, 'Filter controls must remain inside the panel'
                shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
                (WORK/f'clean-filter-{width}.png').write_bytes(base64.b64decode(shot['data']))
                assert await js('document.documentElement.scrollWidth<=innerWidth')
            await call('Emulation.setDeviceMetricsOverride',{'width':1512,'height':1100,'deviceScaleFactor':1,'mobile':False})
            for name,expression in [('scope',"document.querySelector('.filter-panel').scrollIntoView({block:'start'})"),('diagnostics',"document.querySelector('.report-audit').open=true;document.querySelector('.report-audit').scrollIntoView({block:'start'})"),('charts',"document.querySelector('.trend-grid').scrollIntoView({block:'start'})")]:
                await js(expression)
                shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
                (WORK/f'overview-{name}.png').write_bytes(base64.b64decode(shot['data']))
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
