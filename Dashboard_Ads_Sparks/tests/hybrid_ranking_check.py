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
    browser = subprocess.Popen([str(CHROME), '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9347', '--remote-allow-origins=http://localhost:9347', '--user-data-dir='+str(WORK/'chrome-audit-third-fresh'), '--window-size=1512,1100', 'http://127.0.0.1:8847/Dashboard_ads.html'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
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
            qa={}
            for name in ['hybrid-ranking','cost-targets','content-ranking','rules','adsets','center-cards','report-summary']:
                result=await js((ROOT/('tests/'+name+'.js')).read_text(encoding='utf-8'))
                qa[name]=result
                (WORK/'audit/browser-checks.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
                print(name, len(result['checks'] if isinstance(result,dict) else result), 'checks',flush=True)
                checks=result['checks'] if isinstance(result,dict) else result
                assert all(c['ok'] for c in checks)
            live=await js(r"""(()=>{view='centers';for(const id of ['accountFilter','centerFilter','campaignFilter','roleFilter','messageFilter'])$(id).value='ALL';$('searchFilter').value='';$('startFilter').value='2026-10-01';$('endFilter').value='2026-11-11';$('objectiveFilter').value='WHATSAPP';updateOptions();render();const output=[];for(const metric of ['cpl','cpb']){const ranks=ContentRanking.rank(selected,'content',metric,config);for(const bucket of ranks.filter(g=>g.center==='MKS')){const iex=bucket.top.find(g=>g.title==='IEXBE_13');if(bucket.worst.some(g=>g.title==='IEXBE_13'&&g.cost<=CostTargets.limit(metric,config)))throw Error('Affordable IEX ranked worst');output.push({metric,top:bucket.top.map(g=>({ad:g.title,cost:g.cost,results:g.results,leads:g.leads,booking:g.booking,spend:g.spend})),worst:bucket.worst.map(g=>g.title)});}}return output;})()""")
            print('LIVE MKS',live,flush=True)
            for name in ['overview','centers','messages','creatives','alerts','meeting','data']:
                result=await js("(()=>{navigate('"+name+"');return {view,chars:$('viewContent').textContent.length};})()")
                assert result['view']==name and result['chars']>100,result
                print('VIEW',result,flush=True)
            for sort in ['outcomes','cost']:
                actual=await js("(()=>{view='centers';render();$('contentRankSort').value='"+sort+"';$('contentRankSort').dispatchEvent(new Event('change',{bubbles:true}));return contentRankSort;})()")
                assert actual==sort,actual
            await js("settings()")
            values=await js("({cpl:$('cplTargetInput').value,cpb:$('cpbTargetInput').value})")
            assert values=={'cpl':'40000','cpb':'300000'},values
            await js("$('settingsDialog').close();view='centers';contentRankMetric='cpb';$('centerFilter').value='MKS';render();document.querySelector('.content-rankings').scrollIntoView()")
            shot=await call('Page.captureScreenshot',{'format':'png','captureBeyondViewport':False})
            (WORK/'hybrid-ranking-mks.png').write_bytes(base64.b64decode(shot['data']))
            await call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':False})
            await js("render();document.querySelector('.content-rankings').scrollIntoView()")
            bounds=await js("({width:innerWidth,document:document.documentElement.scrollWidth})")
            assert bounds['document']<=bounds['width']+1,bounds
            print('MOBILE BOUNDS',bounds,flush=True)
            print('ERRORS',errors,flush=True)
            assert not errors
            await call('Browser.close')
    finally:
        for proc in [browser,server]:
            if proc.poll() is None:proc.terminate()
if __name__=='__main__':asyncio.run(run())
