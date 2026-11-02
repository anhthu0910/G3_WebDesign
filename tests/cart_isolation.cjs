const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync('frontend/js/cart.js', 'utf8');
const storage = new Map();
async function openCart(user, status = user ? 200 : 401) {
  const context = vm.createContext({
    fetch: async () => ({ ok: status === 200, status, json: async () => ({ user }) }),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    window: { dispatchEvent() {} }, CustomEvent: class {}, console, alert() {}
  });
  vm.runInContext(source, context);
  await vm.runInContext('cartReady', context);
  return code => vm.runInContext(code, context);
}
(async () => {
  let run = await openCart(null);
  run('addToCart(1)');
  run = await openCart({ id: 7 });
  assert.equal(run('getCartCount()'), 0);
  run('addToCart(2)');
  run = await openCart({ id: 8 });
  assert.equal(run('getCartCount()'), 0);
  run('addToCart(3)');
  run = await openCart({ id: 7 });
  assert.equal(run('getCart()[0].id'), '2');
  run = await openCart(null);
  assert.equal(run('getCart()[0].id'), '1');
  console.log('Cart isolation and persistence passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
