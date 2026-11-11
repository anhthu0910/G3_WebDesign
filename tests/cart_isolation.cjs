const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('frontend/js/cart.js', 'utf8');
const storage = new Map();
async function openCart(user, status = user ? 200 : 401) {
  const context = vm.createContext({
    fetch: async () => ({ ok: status === 200, status, json: async () => ({ user }) }),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    window: { dispatchEvent() {}, addEventListener() {} }, CustomEvent: class {},
    document: { addEventListener() {}, querySelectorAll: () => [] }, console, alert() {}
  });
  vm.runInContext(source, context);
  await vm.runInContext('cartReady', context);
  return code => vm.runInContext(code, context);
}
(async () => {
  let run = await openCart(null);
  run('addToCart(1)');
  run = await openCart({ id: 7, role: "user" });
  assert.equal(run('getCartCount()'), 0);
  run('addToCart(2)');
  run = await openCart({ id: 8, role: "user" });
  assert.equal(run('getCartCount()'), 0);
  run('addToCart(3)');
  run = await openCart({ id: 7, role: "user" });
  assert.equal(run('getCart()[0].id'), '2');
  run = await openCart(null);
  assert.equal(run('getCartCount()'), 0);
  run('saveCart([{id: 1, quantity: 4}]); updateCartQuantity(1, 3); removeFromCart(1); clearCart()');
  assert.equal(storage.has('glowguide_cart:guest'), false);
  run = await openCart({ id: 7, role: 'user' });
  for (const quantity of ['NaN', 'Infinity', '1.5', '"2"']) {
    run(`updateCartQuantity(2, ${quantity})`);
    assert.equal(run('getCartCount()'), 1);
  }
  run('updateCartQuantity(2, 1000)');
  assert.equal(run('getCartCount()'), 999);
  run('addToCart(2)');
  assert.equal(run('getCartCount()'), 999);
  run('saveCart([{id: 2, quantity: 2}, {id: 2, quantity: 3}, {id: 0, quantity: 1}, {id: 3, quantity: -1}])');
  assert.equal(run('getCart().length'), 1);
  assert.equal(run('getCartCount()'), 5);
  run('updateCartQuantity(2, 0)');
  assert.equal(run('getCartCount()'), 0);
  run = await openCart({ id: 9, role: 'admin' });
  run('addToCart(1); saveCart([{id: 1, quantity: 1}])');
  assert.equal(storage.has('glowguide_cart:user:9'), false);
  console.log('Cart isolation and persistence passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
