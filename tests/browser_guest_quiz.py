"""Local Guest/User/Admin browser verification; no screenshots or reports."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import shutil
import uuid
from types import SimpleNamespace
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
storage_path=(ROOT/'data'/('guest-quiz-test-'+uuid.uuid4().hex)).resolve()
storage_path.mkdir()
def cleanup_storage():
    assert storage_path.parent == (ROOT/'data').resolve() and storage_path.name.startswith('guest-quiz-test-')
    shutil.rmtree(storage_path)
storage=SimpleNamespace(name=str(storage_path),cleanup=cleanup_storage)
os.environ.update(APP_ENV='development',COOKIE_SECURE='false',GEMINI_API_KEY='',DATABASE_PATH=str(Path(storage.name)/'test.db'),UPLOAD_DIR=str(Path(storage.name)/'uploads'))
from backend.main import app
from backend.database import get_connection
from backend.services.auth_service import create_user
user=create_user('browser-one','one@example.test','password-123')
create_user('browser-two','two@example.test','password-123')
admin=create_user('browser-admin','admin@example.test','password-123')
with get_connection() as db: db.execute("UPDATE users SET role='admin' WHERE id=?",(admin['id'],))
PORT,DEBUG=8810,9240
for port in (PORT,DEBUG):
    with socket.socket() as sock: sock.bind(('127.0.0.1',port))
server=browser=ws=None
sequence=checks=0
events=[]
try:
    server=subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',str(PORT)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    for _ in range(100):
        try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/health');break
        except Exception: time.sleep(.1)
    def command(method,params=None):
        global sequence
        sequence+=1;ident=sequence
        ws.send(json.dumps(dict(id=ident,method=method,params=params or {})))
        while True:
            message=json.loads(ws.recv())
            if message.get('id')==ident:
                if 'error' in message: raise AssertionError(message['error'])
                return message.get('result',{})
            events.append(message)
            if message.get('method')=='Page.javascriptDialogOpening':
                sequence+=1
                ws.send(json.dumps(dict(id=sequence,method='Page.handleJavaScriptDialog',params={'accept':True})))
    def evaluate(expression):
        result=command('Runtime.evaluate',dict(expression=expression,returnByValue=True,awaitPromise=True))
        if 'exceptionDetails' in result: raise AssertionError(result['exceptionDetails'])
        return result.get('result',{}).get('value')
    def wait(expression):
        for _ in range(150):
            if evaluate(expression):return
            time.sleep(.1)
        raise AssertionError('Timed out: '+expression)
    def visit(path):
        if not path.startswith('/'):path='/frontend/html/'+path
        command('Page.navigate',dict(url=f'http://127.0.0.1:{PORT}'+path))
        wait("document.readyState==='complete'");time.sleep(.15)
    def check(name,actual,expected):
        global checks
        assert actual==expected,(name,actual,expected)
        checks+=1
    def api(path,method='GET',body=None):
        options={'method':method}
        if body is not None:options.update(headers={'Content-Type':'application/json'},body=json.dumps(body))
        return evaluate(f"fetch({json.dumps(path)},{json.dumps(options)}).then(async r=>({{status:r.status,data:await r.json()}}))")
    def start():
        global browser,ws
        browser=subprocess.Popen([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--disable-gpu','--no-first-run',f'--remote-debugging-port={DEBUG}','--remote-allow-origins=*','--user-data-dir='+str(Path(storage.name)/'chrome'),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
        for _ in range(100):
            try: tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG}/json', timeout=1));break
            except Exception:time.sleep(.1)
        from websockets.sync.client import connect
        ws=connect(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'),max_size=20_000_000)
        command('Page.enable');command('Runtime.enable');command('Network.enable')
        command('Network.setBlockedURLs',{'urls':['https://*']})
        command('Emulation.setDeviceMetricsOverride',dict(width=390,height=900,deviceScaleFactor=1,mobile=False))
    def stop():
        global browser,ws
        try:command('Browser.close')
        except Exception:pass
        if ws:ws.close();ws=None
        if browser:browser.wait(timeout=15);browser=None
    def fill_login(name):
        evaluate(f"document.querySelector('#identifier').value={json.dumps(name)};document.querySelector('#password').value='password-123';document.querySelector('#loginButton').click()")
    def login(name,role='user'):
        visit('/admin/login' if role=='admin' else '/login');fill_login(name)
        target='admin_index.html' if role=='admin' else 'index.html'
        wait(f"location.pathname.endsWith('/{target}')")
        if role=='user':evaluate('cartReady')
    def quiz():
        visit('skin_quiz.html');wait("!!document.querySelector('#startQuizButton')")
        evaluate("document.querySelector('#startQuizButton').click()")
        wait("document.querySelectorAll('.quiz-option').length>0")
        check('required quiz answer',evaluate("document.querySelector('#nextButton').disabled"),True)
        for _ in range(5):evaluate("document.querySelector('.quiz-option').click();document.querySelector('#nextButton').click()")
        check('quiz result',evaluate("document.querySelector('.result-type').textContent"),'Dry Skin')
    start()
    quiz()
    wait("!!JSON.parse(localStorage.getItem('glowguide_skin_profile')||'null')?.completionId")
    with get_connection() as db:
        for _ in range(100):
            if db.execute('SELECT COUNT(*) FROM quiz_completions').fetchone()[0] == 1: break
            time.sleep(.05)
    saved=evaluate("localStorage.getItem('glowguide_skin_profile')")
    check('Guest result stored locally',json.loads(saved)['skinType'],'dry')
    check('Guest has no account',api('/api/user/profile')['status'],401)
    visit('index.html');visit('skin_quiz.html')
    wait("!!document.querySelector('.result-type')")
    check('Guest result restored after navigating away',evaluate("document.querySelector('.result-type').textContent"),'Dry Skin')
    check('Guest welcome hidden after return',evaluate("document.querySelector('#quizWelcome').hidden"),True)
    check('Same completion ID after return',evaluate("JSON.parse(localStorage.getItem('glowguide_skin_profile')).completionId"),json.loads(saved)['completionId'])
    stop();start();visit('skin_quiz.html')
    wait("!!document.querySelector('.result-type')")
    check('Guest result survives browser restart',evaluate("document.querySelector('.result-type').textContent"),'Dry Skin')
    check('Guest completion unchanged on restart',evaluate("JSON.parse(localStorage.getItem('glowguide_skin_profile')).completionId"),json.loads(saved)['completionId'])
    login('browser-admin','admin')
    wait("document.querySelectorAll('.home-overview-card').length===5")
    count_js="Number([...document.querySelectorAll('.home-overview-card')].find(e=>e.querySelector('span').textContent==='Quiz Completions').querySelector('strong').textContent)"
    check('Dashboard includes first Guest completion',evaluate(count_js),1)
    admin_ws=ws
    from websockets.sync.client import connect
    browser_info=json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG}/json/version',timeout=2))
    control_ws=connect(browser_info['webSocketDebuggerUrl'],max_size=20_000_000)
    ws=control_ws
    context_id=command('Target.createBrowserContext')['browserContextId']
    target_id=command('Target.createTarget',{'url':'about:blank','browserContextId':context_id})['targetId']
    tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG}/json', timeout=1))
    from websockets.sync.client import connect
    guest_ws=connect(next(t['webSocketDebuggerUrl'] for t in tabs if t['id']==target_id),max_size=20_000_000)
    ws=guest_ws
    command('Page.enable');command('Runtime.enable');command('Network.enable')
    command('Network.setBlockedURLs',{'urls':['https://*']})
    quiz()
    wait("!!JSON.parse(localStorage.getItem('glowguide_skin_profile')||'null')?.completionId")
    guest_id=evaluate("JSON.parse(localStorage.getItem('glowguide_skin_profile')).completionId")
    check('New Guest protected profile denied',api('/api/user/profile')['status'],401)
    for _ in range(100):
        with get_connection() as db: recorded=db.execute('SELECT COUNT(*) FROM quiz_completions').fetchone()[0]
        if recorded == 2: break
        time.sleep(.05)
    check('New Guest completion persisted to SQLite',recorded,2)
    ws=admin_ws
    check('Dashboard still displays earlier count before Refresh',evaluate(count_js),1)
    evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent==='Refresh').click()")
    wait("document.querySelectorAll('.home-overview-card').length===5 && !document.querySelector('main button').disabled")
    wait("document.querySelectorAll('.home-overview-card').length===5 && ("+count_js+")===2")
    check('Refresh updates dashboard after new Guest finishes quiz',evaluate(count_js),2)
    ws=guest_ws
    visit('skin_quiz.html');wait("!!document.querySelector('.result-type')")
    check('Reload preserves new Guest completion ID',evaluate("JSON.parse(localStorage.getItem('glowguide_skin_profile')).completionId"),guest_id)
    ws=admin_ws
    evaluate("document.querySelector('main button').click()")
    wait("document.querySelectorAll('.home-overview-card').length===5 && !document.querySelector('main button').disabled")
    check('Refresh does not count Guest result reload twice',evaluate(count_js),2)
    guest_ws.close()
    control_ws.close()
    check('No uncaught browser errors',sum(e.get('method')=='Runtime.exceptionThrown' for e in events),0)
    print(f'{checks} Guest quiz and Dashboard Refresh browser checks passed.')
finally:
    if browser:
        try:stop()
        except Exception:browser.terminate();browser.wait(timeout=15)
    if server:server.terminate();server.wait(timeout=15)
    storage.cleanup()
