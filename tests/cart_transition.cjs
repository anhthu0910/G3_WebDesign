const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
async function open(storage, user = null, options = {}) {
    const alerts = [];
    const c = vm.createContext({ fetch: async () => ({ ok: !!user, status: user ? 200 : 401, json: async () => ({ user }) }), localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => { if (options.failWrite) throw Error('quota'); storage.set(k, v) } }, window: { dispatchEvent() { }, addEventListener() { } }, document: { addEventListener() { }, querySelectorAll: () => [] }, CustomEvent: class { }, console, alert: text => alerts.push(text) });
    vm.runInContext(fs.readFileSync('frontend/js/cart.js', 'utf8'), c); await vm.runInContext('cartReady', c);
    return { run: text => vm.runInContext(text, c), alerts };
}
(async () => {
    const storage = new Map([['glowguide_cart:guest', '[{"id":1,"quantity":2}]'], ['glowguide_cart:user:7', '[{"id":2,"quantity":3}]']]);
    const original = new Map(storage);
    let { run, alerts } = await open(storage);
    run('addToCart(1);saveCart([{id:1,quantity:5}]);updateCartQuantity(1,3);removeFromCart(1);clearCart()');
    assert.deepEqual(alerts, ['Please log in to add items to your cart.']);
    assert.equal(run('getCartCount()'), 0);
    assert.deepEqual(storage, original);
    ({ run } = await open(storage, { id: 7, role: 'user' }));
    assert.equal(run('getCartCount()'), 3);
    assert.equal(run('getCart().some(item=>item.id==="1")'), false);
    assert.equal(run('typeof mergeGuestCart'), 'undefined');
    run('addToCart(1);updateCartQuantity(1,1.5);addToCart(true);addToCart(-1)');
    assert.equal(run('getCartCount()'), 4);
    ({ run } = await open(storage, { id: 8, role: 'user' })); assert.equal(run('getCartCount()'), 0);
    ({ run } = await open(storage)); assert.equal(run('getCartCount()'), 0);
    ({ run } = await open(storage, { id: 7, role: 'user' })); assert.equal(run('getCartCount()'), 4);
    assert.equal(storage.get('glowguide_cart:guest'), original.get('glowguide_cart:guest'));
    ({ run, alerts } = await open(storage, { id: 7, role: 'user' }, { failWrite: true }));
    run('addToCart(3)'); assert.equal(run('getCartCount()'), 4); assert.equal(alerts.length, 1);
    const nodes = { loginForm: { dataset: { loginRole: 'user' }, addEventListener(type, fn) { this.submit = fn }, querySelector: selector => nodes[selector.slice(1)] }, loginButton: {}, authMessage: {}, identifier: { value: 'user' }, password: { value: 'password' }, showPassword: { addEventListener() { } } };
    const login = vm.createContext({ document: { getElementById: id => nodes[id], addEventListener(type, fn) { fn() } }, window: { location: {} }, authRequest: async () => ({ user: { id: 7, role: 'user' } }), mergeGuestCart() { throw Error('Guest migration must never run') } });
    vm.runInContext(fs.readFileSync('frontend/js/login.js', 'utf8'), login);
    await nodes.loginForm.submit({ preventDefault() { } });
    assert.equal(login.window.location.href, '/frontend/html/index.html');
    const source = fs.readFileSync('frontend/js/skin_quiz.js', 'utf8');
    const score = source.slice(source.indexOf('  function calculateResult()'), source.indexOf('  function showResult()'));
    for (const type of ['dry', 'normal', 'oily', 'combination', 'sensitive']) {
        const c = vm.createContext({ questions: [{ answers: [{ type }] }], selectedAnswers: [0] }); vm.runInContext(score, c); assert.equal(c.calculateResult().skinType, type);
    }
    console.log('Guest cart blocked, English login prompt, no migration, account isolation/persistence, storage errors and quiz types passed.');
})().catch(e => { console.error(e); process.exitCode = 1 });
