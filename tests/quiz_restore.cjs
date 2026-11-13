const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
class Element {
  constructor() { this.hidden = false; this.children = []; this.style = {}; this.listeners = {}; this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener(event, handler) { this.listeners[event] = handler; }
}
async function openQuiz(saved) {
  const elements = new Map(); const calls = [];
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  let ready;
  const context = {
    document: { addEventListener: (name, fn) => { if (name === 'DOMContentLoaded') ready = fn; }, getElementById: get, querySelector: get, createElement: () => new Element() },
    window: { addEventListener() {} }, console, URLSearchParams, crypto: { randomUUID },
    localStorage: { getItem: () => JSON.stringify(saved), setItem() {} },
    fetch: async (url, options) => { calls.push({url, options}); return { ok: true, json: async () => ({ questions: [] }) }; }
  };
  vm.runInNewContext(fs.readFileSync('frontend/js/skin_quiz.js', 'utf8'), context);
  await ready();
  return { get, calls };
}
(async () => {
  const id = randomUUID();
  const page = await openQuiz({skinType:'dry', concern:'dryness', inconclusive:false, completionId:id});
  assert.equal(page.get('quizWelcome').hidden, true);
  assert.equal(page.get('quizResult').hidden, false);
  assert.equal(page.get('quizResult').children[1].textContent, 'Dry Skin');
  assert.equal(JSON.parse(page.calls.find(c => c.url === '/api/quiz/completions').options.body).completion_id, id);
  const legacy = await openQuiz({skinType:'oily', concern:'acne', inconclusive:false});
  assert.equal(legacy.get('quizResult').children[1].textContent, 'Oily Skin');
  assert.equal(legacy.calls.filter(c => c.url === '/api/quiz/completions').length, 0);
  console.log('Quiz results restore correctly; legacy results do not create new completions.');
})();
