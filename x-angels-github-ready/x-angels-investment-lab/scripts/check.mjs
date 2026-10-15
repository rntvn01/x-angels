import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const assets = fs.existsSync(path.join(root, 'dist/index.html')) ? path.join(root, 'dist') : root;
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(assets, 'app.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const id of [...script.matchAll(/\$\('([^']+)'\)/g)].map(x => x[1])) assert(ids.includes(id), 'Missing DOM element: ' + id);
for (const asset of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x => x[1]).filter(x => !/^(https?:|data:|mailto:|tel:|#)/.test(x))) assert(fs.existsSync(path.join(assets, asset)), 'Missing asset: ' + asset);
assert.deepEqual([...html.matchAll(/name="amount" value="(\d+)"/g)].map(x => Number(x[1])), [25000, 50000, 75000, 100000]);
assert(html.includes('Правильной суммы инвестиций нет.'));
assert(html.includes('Размер чека не влияет на выбор победителя.'));
assert(html.includes('https://t.me/+XJa3T4G_Bxw1YzE6'));
const controls = [...html.matchAll(/<(input|textarea)\b[^>]*>/g)].map(x => x[0]);
assert.deepEqual(controls.filter(x => /\srequired(?:\s|>)/.test(x)).map(x => x.match(/id="([^"]+)"/)[1]), ['thesis']);
assert(controls.find(x => x.includes('id="thesis"')).includes('minlength="1"'));
assert(!html.includes('tel:') && !html.includes('gmail.com'));

class Element {
  constructor(id = '') { this.id = id; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.textContent = ''; this.attributes = new Map(); this.listeners = {}; this.open = false; this.classList = { toggle() {} }; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  async emit(name) { for (const fn of this.listeners[name] || []) await fn({ preventDefault() {} }); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  checkValidity() { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value); }
  focus() { this.focused = true; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelectorAll() { return []; }
  appendChild() {}
  click() {}
  remove() {}
}
function createHarness(options = {}) {
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const radios = [25000, 50000, 75000, 100000].map(value => Object.assign(new Element(), { value: String(value) }));
  const journey = [new Element(), new Element(), new Element()];
  const footer = new Element();
  const extraFields = new Element();
  let copiedText = '';
  const cache = new Map(options.storage ? Object.entries(options.storage) : []);
  const calls = [];
  const document = {
    getElementById: id => { assert(elements[id], id); return elements[id]; },
    querySelectorAll: selector => selector === 'input[name="amount"]' ? radios : selector === '.journey li' ? journey : [],
    querySelector: selector => { if (selector === '.extra-fields') return extraFields; assert.equal(selector, '.answer-foot>span'); return footer; },
    createElement: () => new Element(), body: new Element()
  };
  let response = options.response || { ok: true, json: async () => ({ success: 'true' }) };
  const context = {
    document, localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => { if (options.storageBlocked) throw new Error('blocked'); cache.set(key, value); } },
    window: { scrollTo() {}, addEventListener() {} }, navigator: { clipboard: { writeText: async text => { copiedText = text; } } },
    location: { origin: 'https://x-angels-investment-lab.example', pathname: '/' },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' }, Blob, URL, AbortController,
    setTimeout: () => 1, clearTimeout() {}, Date, Math, Number, String, JSON,
    fetch: async (url, request) => { calls.push({ url, ...request }); if (response instanceof Error) throw response; return response; }
  };
  vm.runInNewContext(script, context);
  return { elements, radios, journey, cache, calls, extraFields, copiedText: () => copiedText, setResponse: value => { response = value; } };
}
async function choose(h, index) { await h.radios[index].emit('change'); await h.elements['to-reason'].emit('click'); }
async function fill(h) {
  const values = { participant: 'Тестовый участник', email: 'participant@example.com', thesis: 'Я выбираю этот чек, потому что вижу рост выручки, но хочу сохранить резерв для диверсификации.', risks: 'Один клиент даёт слишком большую долю выручки.', checks: 'Запрошу когорты, стоимость привлечения клиентов и структуру капитала.' };
  for (const [key, value] of Object.entries(values)) { h.elements[key].value = value; await h.elements[key].emit('input'); }
}
for (let i = 0; i < 4; i++) {
  const h = createHarness();
  assert.equal(h.elements['to-reason'].disabled, true);
  await choose(h, i); await fill(h);
  await h.elements['thesis-form'].emit('submit');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://formsubmit.co/ajax/info@astanaventure.com');
  const payload = JSON.parse(h.calls[0].body);
  assert.equal(payload['Учебный чек (USD)'], String([25000, 50000, 75000, 100000][i]));
  assert.equal(payload.email, 'participant@example.com');
  assert.equal(payload.name, 'Тестовый участник');
  assert(payload['Правило конкурса'].startsWith('Нет правильной суммы.'));
  assert.equal(h.elements['result-panel'].hidden, false);
  assert.equal(h.elements['reason-panel'].hidden, true);
  assert.equal(h.elements['submit-answer'].disabled, false);
  await h.elements['edit-answer'].emit('click');
  await h.elements['thesis-form'].emit('submit');
  assert.equal(h.calls.length, 1, 'Unchanged acknowledged answer must not be sent twice');
  const reloaded = createHarness({ storage: Object.fromEntries(h.cache) });
  assert.equal(reloaded.elements['result-panel'].hidden, false, 'Acknowledged response resumes on reload');
}
{
  const h = createHarness(); await choose(h, 0);
  await h.elements['thesis-form'].emit('submit'); assert.equal(h.calls.length, 0, 'Invalid response must not send');
  await fill(h); h.elements.email.value = 'invalid';
  await h.elements['thesis-form'].emit('submit'); assert.equal(h.calls.length, 0, 'Invalid email must not send');
}
for (const failedResponse of [new Error('offline'), { ok: false }, { ok: true, json: async () => ({ success: false }) }]) {
  const h = createHarness({ response: failedResponse }); await choose(h, 1); await fill(h); await h.elements['thesis-form'].emit('submit');
  assert.equal(h.elements['reason-panel'].hidden, false, 'Delivery failure must retain the form');
  assert.equal(h.elements['result-panel'].hidden, true, 'Delivery failure must not claim success');
  assert.equal(h.elements['form-error'].hidden, false);
  assert.equal(h.elements['submit-answer'].disabled, false, 'Retry enabled');
  const record = JSON.parse([...h.cache.values()][0]); assert.equal(record.completed, false);
  const originalId = record.submissionId;
  h.setResponse({ ok: true, json: async () => ({ success: true }) }); await h.elements['thesis-form'].emit('submit');
  assert.equal(h.elements['result-panel'].hidden, false);
  assert.equal(JSON.parse(h.calls[1].body)['Номер ответа'], originalId, 'Retry must retain submission ID');
}
{
  const h = createHarness({ storage: { 'xangels-investment-lab-v1': '{broken' }, storageBlocked: true });
  await choose(h, 3); await fill(h); await h.elements['thesis-form'].emit('submit');
  assert.equal(h.elements['result-panel'].hidden, false, 'Unavailable storage must not block delivery');
  await h.elements['restart-confirm'].emit('click');
  assert.equal(h.elements['case-panel'].hidden, false); assert.equal(h.elements.email.value, ''); assert.equal(h.elements['to-reason'].disabled, true);
}

// One visible character is sufficient; every other text field may be blank.
{
  const h = createHarness(); await choose(h, 0);
  h.elements.thesis.value = 'Я'; await h.elements.thesis.emit('input');
  await h.elements['thesis-form'].emit('submit');
  assert.equal(h.calls.length, 1);
  const payload = JSON.parse(h.calls[0].body);
  assert.equal(payload['Инвестиционный тезис'], 'Я');
  assert.equal(payload.name, 'Участник без имени');
  assert(!('email' in payload));
  assert(!('Главный риск' in payload));
  assert(!('Вопросы перед сделкой' in payload));
  assert.equal(h.elements['answer-card'].hidden, false);
  assert.equal(h.elements['result-risks-block'].hidden, true);
  assert.equal(h.elements['result-checks-block'].hidden, true);
  await h.elements['copy-answer'].emit('click');
  assert(h.copiedText().includes('ИНВЕСТИЦИОННЫЙ ТЕЗИС\nЯ'));
  assert(!h.copiedText().includes('Почта:'));
  assert(!h.copiedText().includes('ОБОСНОВАНИЕ'));
  const reloaded = createHarness({ storage: Object.fromEntries(h.cache) });
  assert.equal(reloaded.elements['result-panel'].hidden, false);
  assert.equal(reloaded.elements['answer-card'].hidden, false);
}
{
  const h = createHarness(); await choose(h, 1);
  h.elements.thesis.value = ' \n\t ';
  await h.elements['thesis-form'].emit('submit');
  assert.equal(h.calls.length, 0, 'Whitespace is not a thesis');
  assert.equal(h.elements.thesis.getAttribute('aria-invalid'), 'true');
  for (const field of ['participant', 'thesis', 'risks', 'checks']) h.elements[field].value = 'А';
  await h.elements['thesis-form'].emit('submit');
  assert.equal(h.calls.length, 1, 'No hidden minimum for optional fields');
  const payload = JSON.parse(h.calls[0].body);
  assert.equal(payload.name, 'А');
  assert.equal(payload['Главный риск'], 'А');
  assert.equal(payload['Вопросы перед сделкой'], 'А');
}
// Opening the debrief must not submit a form or display a delivery confirmation.
{
  const h = createHarness(); await h.elements['skip-case'].emit('click');
  assert.equal(h.calls.length, 0);
  assert.equal(h.elements['result-panel'].hidden, false);
  assert.equal(h.elements['delivery-status'].hidden, true);
  assert.equal(h.elements['answer-card'].hidden, true);
  assert.equal(h.elements['sizing-title'].textContent, 'Какой резерв оставить?');
  const reloaded = createHarness({ storage: Object.fromEntries(h.cache) });
  assert.equal(reloaded.elements['result-panel'].hidden, false);
  assert.equal(reloaded.elements['delivery-status'].hidden, true);
  await h.elements['result-to-thesis'].emit('click');
  assert.equal(h.elements['case-panel'].hidden, false);
  await choose(h, 2); h.elements.email.value = 'invalid';
  await h.elements['skip-answer'].emit('click');
  assert.equal(h.calls.length, 0);
  assert.equal(h.elements['result-panel'].hidden, false);
  await h.elements['result-to-thesis'].emit('click');
  assert.equal(h.elements['reason-panel'].hidden, false);
}
// Existing browser drafts remain available, including optional analysis.
{
  const h = createHarness({ storage: { 'xangels-investment-lab-v1': JSON.stringify({ amount: 50000, stage: 1, thesis: 'Я', risks: 'Риск' }) } });
  assert.equal(h.elements.thesis.value, 'Я');
  assert.equal(h.elements.risks.value, 'Риск');
  assert.equal(h.extraFields.open, true);
}
console.log('PASS: assets and IDs; four amounts; optional contact fields; one-character thesis; whitespace and email validation; optional analysis; payload and copy; delivery failures and retry; duplicate protection; draft reload; skip without delivery; blocked storage; reset.');
