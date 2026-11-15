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
    server = subprocess.Popen(['python', '-m', 'http.server', '8847', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9347', '--remote-allow-origins=http://localhost:9347', '--user-data-dir='+str(WORK/'chrome-scorecards-qa'), '--window-size=1512,1100', 'http://127.0.0.1:8847/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
    counter = 0
    errors = []
    try:
        targets = []
        for _ in range(50):
            try:
                targets = json.load(urllib.request.urlopen('http://127.0.0.1:9347/json', timeout=1))
                if any(t['type']=='page' for t in targets): break
            except Exception: pass
            await asyncio.sleep(.2)
        target = next(t for t in targets if t['type']=='page')
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=16*1024*1024, origin='http://localhost:9347') as ws:
            async def call(method, params=None):
                nonlocal counter
                counter += 1
                seq = counter
                await ws.send(json.dumps({'id': seq, 'method': method, 'params':params or {}}))
                while True:
                    data=json.loads(await asyncio.wait_for(ws.recv(),60))
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
            await call('Network.enable')
            await call('Network.setCacheDisabled',{'cacheDisabled':True})
            await call('Page.navigate',{'url':'http://127.0.0.1:8847/Dashboard_ads.html?audit='+str(time.time_ns())})
            await asyncio.sleep(1)
            for _ in range(90):
                status=await js("typeof loaded!=='undefined' ? {loaded,busy,lastError} : null")
                if status and (status['loaded'] or not status['busy']):break
                await asyncio.sleep(.5)
            print('SYNC',json.dumps(status),flush=True)
            print('BUILD',await js('typeof A.adIdentity'),flush=True)
            
            assert status and status['loaded'],status
            await js("$('startFilter').value='2026-10-01';$('endFilter').value='2026-11-12';render()")
            for name in ['metric-scorecards','scorecard-targets','target-editor']:
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                print(name,json.dumps({'passed':len(result.get('checks',[]))}),flush=True)
            result=await js((ROOT/'tests/scorecards-ui.js').read_text(encoding='utf-8'))
            print('UI',json.dumps(result),flush=True)
            (WORK/'scorecards-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            await call('Emulation.setDeviceMetricsOverride',{'width':1720,'height':1200,'deviceScaleFactor':1,'mobile':False})
            await js("navigate('scorecards');document.querySelector('.sc-controls').scrollIntoView()")
            await asyncio.sleep(.3)
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'scorecards-desktop.png').write_bytes(base64.b64decode(shot['data']))
            await call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
            await js("openScorecardTargets(); for(const [k,v] of Object.entries({spend:'8000000',results:'1000',leads:'900',booking:'100'})){const e=$('plan_'+k);e.value=v;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));}")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'targets-dialog.png').write_bytes(base64.b64decode(shot['data']))
            await js("$('scorecardTargetsDialog').close()")
            await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
            await js("document.querySelector('.sc-controls').scrollIntoView()")
            await asyncio.sleep(.3)
            mobile=await js("({width:innerWidth,doc:document.documentElement.scrollWidth,cards:document.querySelectorAll('.sc-card').length})")
            print('MOBILE',json.dumps(mobile),flush=True)
            assert mobile['doc']<=mobile['width']+1,mobile
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'scorecards-mobile.png').write_bytes(base64.b64decode(shot['data']))
            await js("openScorecardTargets()")
            layout=await js("(()=>{const d=$('scorecardTargetsDialog'),b=$('planSave').getBoundingClientRect();return {dialog:d.clientWidth,scroll:d.scrollWidth,saveVisible:b.top>=0&&b.bottom<=innerHeight,helpOpen:document.querySelector('.target-help').open};})()")
            assert layout['saveVisible'] and layout['scroll']<=layout['dialog']+1 and not layout['helpOpen'],layout
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'targets-mobile.png').write_bytes(base64.b64decode(shot['data']))
            await js("$('scorecardTargetsDialog').close()")
            print('TARGET MOBILE',json.dumps(layout),flush=True)
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
