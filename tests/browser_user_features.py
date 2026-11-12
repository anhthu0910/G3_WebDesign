"""Local Guest/User/Admin browser verification; no screenshots or reports."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
storage=tempfile.TemporaryDirectory(prefix='browser-test-',dir=ROOT/'data')
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
            try: tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{DEBUG}/json'));break
            except Exception:time.sleep(.1)
        from websockets.sync.client import connect
        ws=connect(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'),legacy=True,max_size=20_000_000)
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
    for login_path in ['/login','/admin/login']:
        visit(login_path)
        wait("!!document.querySelector('#accountArea a') && !document.querySelector('a[href$=\"cart.html\"]')")
        check('shared login navigation '+login_path,evaluate("[...document.querySelectorAll('.navbar nav a')].map(a=>a.textContent.trim())"),['Home','Products','Skin Quiz','AI Consultant','Login / Sign Up'])
        check('login navigation destinations '+login_path,evaluate("[...document.querySelectorAll('.navbar nav a')].every(a=>a.pathname.startsWith('/frontend/html/')||a.pathname==='/login')"),True)
    visit('index.html')
    wait("document.querySelectorAll('.home-buy-link').length===3 && !!document.querySelector('.product-image img')")
    check('Guest Home Buy Now labels',evaluate("[...document.querySelectorAll('.home-buy-link')].every(a=>a.textContent==='Buy Now')"),True)
    home_catalog=api('/api/products')['data']['products'][:3]
    check('Home purchase destinations',evaluate("[...document.querySelectorAll('.home-buy-link')].map(a=>a.href)"),[p['affiliate_url'] or p['product_url'] for p in home_catalog])
    check('Home safe external links',evaluate("[...document.querySelectorAll('.home-buy-link')].every(a=>a.target==='_blank'&&a.rel.includes('noopener')&&a.dataset.affiliateProduct)"),True)
    evaluate("document.querySelector('.home-cart-btn').click()")
    check('Home Guest cart blocked',evaluate('getCartCount()'),0)
    check('Home Guest login prompt',[e['params']['message'] for e in events if e.get('method')=='Page.javascriptDialogOpening'][-1],'Please log in to add items to your cart.')
    check('Purchase URL fallback',evaluate("getPurchaseUrl({affiliate_url:'javascript:alert(1)',product_url:'https://brand.example/item'}).href"),'https://brand.example/item')
    check('Unsafe purchase URL disabled',evaluate("createPurchaseLink({affiliate_url:'javascript:alert(1)'},'buy-btn').getAttribute('aria-disabled')"),'true')
    visit('products.html');evaluate('cartReady')
    wait("document.querySelectorAll('#productGrid .product-card').length===10")
    check('guest products',api('/api/products')['status'],200)
    wait("!document.querySelector('a[href$=\"cart.html\"]')")
    check('Guest Cart navigation removed',evaluate("document.querySelector('a[href$=\"cart.html\"]')===null"),True)
    check('Guest Buy Now buttons',evaluate("[...document.querySelectorAll('#productGrid .buy-btn')].every(a=>a.textContent==='Buy Now') && document.querySelectorAll('#productGrid .buy-btn').length===10"),True)
    check('Buy Now safe purchase links',evaluate("[...document.querySelectorAll('#productGrid .buy-btn[href]')].every(a=>['http:','https:'].includes(new URL(a.href).protocol)&&a.target==='_blank'&&a.rel.includes('noopener')) && !!document.querySelector('#productGrid .buy-btn[href]')"),True)
    check('guest protected profile',api('/api/user/profile')['status'],401)
    check('guest protected Admin',api('/api/admin/me')['status'],401)
    def cart_listener_count():
        return command('Runtime.evaluate',dict(expression="(getEventListeners(window)['glowguide:cartchanged']||[]).length",includeCommandLineAPI=True,returnByValue=True))['result']['value']
    listeners_before=cart_listener_count()
    evaluate("for(let i=0;i<20;i++)document.querySelector('#resetFilters').click()")
    check('Product filters do not accumulate cart listeners',cart_listener_count(),listeners_before)
    evaluate("document.querySelector('#searchInput').value='no-match-xyz';document.querySelector('#searchInput').dispatchEvent(new Event('input'))")
    check('empty search',evaluate("!document.querySelector('#emptyState').hidden"),True)
    evaluate("document.querySelector('#resetFilters').click();document.querySelector('input[name=skinType]').click();document.querySelector('input[name=concern]').click()")
    selected=evaluate("({skin:document.querySelector('input[name=skinType]:checked').value,concern:document.querySelector('input[name=concern]:checked').value})")
    catalog=api('/api/products')['data']['products']
    expected=[p['id'] for p in catalog if selected['skin'] in p.get('skinTypes',[]) and selected['concern'] in p.get('concerns',[])]
    check('combined filters',evaluate("[...document.querySelectorAll('#productGrid .product-card')].map(c=>Number(c.dataset.productId))"),expected)
    check('product detail',api('/api/products/1')['status'],200)
    evaluate("document.querySelector('#resetFilters').click();document.querySelector('.product-cart-btn').click()")
    check('Guest add shows English prompt',[e['params']['message'] for e in events if e.get('method')=='Page.javascriptDialogOpening'][-1],'Please log in to add items to your cart.')
    check('Guest cannot add to cart',evaluate('getCartCount()'),0)
    quiz();guest_profile=evaluate("localStorage.getItem('glowguide_skin_profile')")
    visit('cart.html');wait("location.pathname==='/login'")
    check('Guest cart redirects to login',evaluate('location.pathname'),'/login')
    evaluate(f"localStorage.setItem('glowguide_cart:guest','[{{\"id\":1,\"quantity\":2}},{{\"id\":2,\"quantity\":1}},{{\"id\":999,\"quantity\":1}}]');localStorage.setItem('glowguide_cart:user:{user['id']}','[{{\"id\":1,\"quantity\":4}},{{\"id\":3,\"quantity\":1}}]')")
    legacy_guest=evaluate("localStorage.getItem('glowguide_cart:guest')")
    login('browser-one');check('User cart not merged with Guest',evaluate('getCartCount()'),5)
    wait("document.querySelectorAll('.home-buy-link').length===3 && !!document.querySelector('.product-image img')")
    check('User Home Buy Now labels',evaluate("[...document.querySelectorAll('.home-buy-link')].every(a=>a.textContent==='Buy Now')"),True)
    evaluate("document.querySelector('.home-cart-btn[data-product-id=\"2\"]').click()")
    check('Home User add once',evaluate('getCartCount()'),6)
    evaluate("document.querySelector('.home-cart-btn[data-product-id=\"2\"]').click()")
    check('Home User remove once',evaluate('getCartCount()'),5)
    check('old Guest data not transferred',evaluate("localStorage.getItem('glowguide_cart:guest')"),legacy_guest)
    check('badge',evaluate("document.querySelector('.cart-badge').textContent"),'5')
    visit('products.html');wait("document.querySelectorAll('#productGrid .buy-btn').length===10")
    check('User Buy Now buttons',evaluate("[...document.querySelectorAll('#productGrid .buy-btn')].every(a=>a.textContent==='Buy Now')"),True)
    check('User retains Cart navigation',evaluate("!!document.querySelector('a[href$=\"cart.html\"]')"),True)
    visit('cart.html');evaluate('cartReady');evaluate('addToCart(2)');wait("document.querySelectorAll('.cart-item').length===3")
    check('User can add',evaluate('getCartCount()'),6)
    evaluate("document.querySelector('button[aria-label^=Increase]').click()")
    check('User increase',evaluate('getCartCount()'),7)
    evaluate("document.querySelector('button[aria-label^=Decrease]').click()")
    check('User decrease',evaluate('getCartCount()'),6)
    evaluate("document.querySelector('.cart-remove').click()")
    check('User remove',evaluate('getCartCount()'),2)
    stop();start();visit('cart.html');evaluate('cartReady')
    check('User cart browser restart',evaluate('getCartCount()'),2)
    for width in [320,390,768]:
        command('Emulation.setDeviceMetricsOverride',dict(width=width,height=900,deviceScaleFactor=1,mobile=False))
        check('mobile cart '+str(width),evaluate('document.documentElement.scrollWidth<=innerWidth'),True)
    visit('profile.html');wait("!document.querySelector('#profileForm').hidden")
    evaluate("document.querySelector('#profileForm').hidden=true")
    check('profile loading form hidden',evaluate("getComputedStyle(document.querySelector('#profileForm')).display"),'none')
    evaluate("document.querySelector('#profileForm').hidden=false")
    command('Emulation.setDeviceMetricsOverride',dict(width=320,height=900,deviceScaleFactor=1,mobile=False))
    check('profile mobile overflow',evaluate('document.documentElement.scrollWidth<=innerWidth'),True)
    evaluate("document.querySelector('#profileUsername').value='browser-renamed';document.querySelector('#profileSkinType').value='oily';document.querySelector('#profileConcern').value='acne';document.querySelector('#profileForm').requestSubmit()")
    wait("document.querySelector('#profileStatus').textContent==='Profile saved.'")
    check('account rename',api('/api/auth/me')['data']['user']['username'],'browser-renamed')
    check('preferences',api('/api/user/profile')['data']['skin_profile']['skinType'],'oily')
    quiz();wait("document.querySelector('#quizResult [role=status]').textContent==='Result saved to your account.'")
    check('quiz stored',api('/api/user/profile')['data']['quiz_result']['skinType'],'dry')
    check('guest profile unchanged',evaluate("localStorage.getItem('glowguide_skin_profile')"),guest_profile)
    visit('profile.html');wait("!document.querySelector('#profileForm').hidden")
    check('saved quiz section removed',evaluate("document.querySelector('#savedQuizSection')===null"),True)
    api('/api/auth/logout','POST');visit('cart.html');wait("location.pathname==='/login'")
    check('Guest cannot open account cart after logout',evaluate('location.pathname'),'/login')
    login('browser-two')
    check('other cart isolated',evaluate('getCartCount()'),0)
    check('other profile isolated',api('/api/user/profile?user_id='+str(user['id']))['data']['quiz_result'],None)
    check('User denied Admin',api('/api/admin/me')['status'],403)
    visit('admin_users.html');wait("document.querySelector('#usersStatus').textContent==='You do not have permission to do this.'")
    check('User management hidden from ordinary User',evaluate("document.querySelector('#userManagement').hidden"),True)
    api('/api/auth/logout','POST');login('browser-renamed')
    check('cart retained on relogin',evaluate('getCartCount()'),2)
    with get_connection() as db:db.execute("UPDATE sessions SET expires_at='2000-01-01T00:00:00+00:00' WHERE user_id=?",(user['id'],))
    check('expired profile blocked',api('/api/user/profile')['status'],401)
    visit('profile.html');wait("location.pathname==='/login'")
    visit('/admin/login');fill_login('browser-two')
    wait("document.querySelector('#authMessage').textContent==='Incorrect username or password.'")
    check('User rejected from Admin form',evaluate('location.pathname'),'/admin/login')
    login('browser-admin','admin');check('Admin authorized',api('/api/admin/me')['status'],200)
    wait("!!document.querySelector('nav a[href=\"admin_users.html\"]')")
    evaluate("document.querySelector('nav a[href=\"admin_users.html\"]').click()")
    wait("location.pathname.endsWith('/admin_users.html') && !document.querySelector('#userManagement').hidden")
    check('Admin Users navigation',evaluate("document.querySelector('h1').textContent"),'User Management')
    check('registered User count',evaluate("document.querySelector('#totalUsers').textContent"),'2')
    evaluate("document.querySelector('#userSearch').value='browser-two';document.querySelector('#userSearch').dispatchEvent(new Event('input'))")
    check('User search',evaluate("document.querySelectorAll('#adminUserRows tr[data-user-id]').length"),1)
    evaluate("document.querySelector('#adminUserRows button').click()")
    wait("document.querySelector('#usersStatus').textContent==='Account locked.'")
    check('lock status UI',evaluate("document.querySelector('.users-account-status').textContent"),'Locked')
    check('locked User login denied',api('/api/auth/login','POST',{'identifier':'browser-two','password':'password-123'})['status'],403)
    check('locked account English message',evaluate("authRequest('/api/auth/login',{method:'POST',body:JSON.stringify({identifier:'browser-two',password:'password-123',role:'user'})}).catch(error=>error.message)"),'Your account has been locked. Please contact an administrator.')
    evaluate("document.querySelector('#userStatusFilter').value='locked';document.querySelector('#userStatusFilter').dispatchEvent(new Event('change'))")
    check('locked filter',evaluate("document.querySelectorAll('#adminUserRows tr[data-user-id]').length"),1)
    evaluate("document.querySelector('#adminUserRows button').click()")
    wait("document.querySelector('#usersStatus').textContent==='Account unlocked.'")
    check('unlock updates filter',evaluate("document.querySelectorAll('#adminUserRows tr[data-user-id]').length"),0)
    check('empty filtered state',evaluate("document.querySelector('.users-empty').textContent"),'No matching users found.')
    evaluate("document.querySelector('#userSearch').value='';document.querySelector('#userStatusFilter').value='all';document.querySelector('#userSearch').dispatchEvent(new Event('input'))")
    command('Emulation.setDeviceMetricsOverride',dict(width=320,height=900,deviceScaleFactor=1,mobile=False))
    check('User management mobile overflow',evaluate('document.documentElement.scrollWidth<=innerWidth'),True)
    evaluate("window.realFetch=window.fetch;window.fetch=(...a)=>a[0]==='/api/admin/users'?Promise.resolve(new Response('{}',{status:503})):window.realFetch(...a);document.querySelector('#refreshUsers').click()")
    wait("!document.querySelector('#refreshUsers').disabled")
    check('failed refresh hides old User data',evaluate("document.querySelector('#userManagement').hidden"),True)
    evaluate("window.fetch=window.realFetch;document.querySelector('#refreshUsers').click()")
    wait("!document.querySelector('#refreshUsers').disabled && !document.querySelector('#userManagement').hidden")
    check('refresh retry',evaluate("document.querySelectorAll('#adminUserRows tr[data-user-id]').length"),2)
    api('/api/auth/logout','POST');check('Admin logout',api('/api/admin/me')['status'],401)
    visit('admin_users.html');wait("document.querySelector('#usersStatus').textContent==='Please sign in to continue.'")
    check('Guest management access hidden',evaluate("document.querySelector('#userManagement').hidden"),True)
    visit('register.html')
    evaluate("document.querySelector('#username').value='registered-browser';document.querySelector('#email').value='registered@example.test';document.querySelector('#password').value='password-123';document.querySelector('#confirmPassword').value='password-123';document.querySelector('#registerForm').requestSubmit()")
    wait("location.pathname==='/login'");login('registered-browser')
    check('browser registration',api('/api/auth/me')['data']['user']['username'],'registered-browser')
    api('/api/auth/logout','POST');visit('ai_consultant.html')
    evaluate("window.fetch=async()=>new Response(JSON.stringify({reply:'Mock reply'}),{status:200});document.querySelector('#messageInput').value='Hello';document.querySelector('#chatForm').requestSubmit()")
    wait("!document.querySelector('#sendButton').disabled")
    check('public chat UI',evaluate("[...document.querySelectorAll('.bot-message .message-content')].at(-1).textContent"),'Mock reply')
    check('uncaught browser exceptions',sum(e.get('method')=='Runtime.exceptionThrown' for e in events),0)
    print(f'{checks} browser checks passed; no screenshots or reports written.')
finally:
    if browser:
        try:stop()
        except Exception:browser.terminate();browser.wait(timeout=15)
    if server:server.terminate();server.wait(timeout=15)
    storage.cleanup()
