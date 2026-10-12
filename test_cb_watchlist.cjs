const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
for (const id of ['cb-data-status', 'cb-data-panel', 'cb-data-period', 'cb-data-search', 'cb-data-rows', 'cb-watch-list', 'cb-watch-count', 'cb-watch-filter', 'cb-watch-search']) {
  elements.set(id, {innerHTML: '', textContent: '', value: '', hidden: true, addEventListener() {}, querySelectorAll() { return []; }});
}
elements.get('cb-watch-filter').value = 'watch';
const root = {innerHTML: '', querySelector(selector) { return elements.get(selector.slice(1)); }};
const bars = Array.from({length: 25}, (_, i) => ({date: `2026-09-${String(i + 1).padStart(2, '0')}`, open: 100, high: 101, low: 99, close: 100, volume: 1000}));
const stock = {code: '1234', name: '測試股', bars, t: bars.at(-1)};
const data = {period: '2026-09', bonds: [{code: '12341', name: '測試一', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 90, conversion_price_kind: 'at_issuance', custody: 100, change: 10}]};
const context = {document: {getElementById() { return root; }}, window: {cbStockSnapshot() { return {mode: 'live', analyses: [stock]}; }, addEventListener() {}, dispatchEvent() {}}, fetch: async () => ({ok: true, json: async () => data}), Event: class {}, Intl, Date, Number, String, Array, Map, Math, Object, console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('convertible-radar.js', 'utf8'), context);
setImmediate(() => {
  assert.equal(context.window.convertibleDataStatus, 'ready');
  assert.equal(context.window.activeConvertibleBonds('1234').length, 1);
  assert.match(elements.get('cb-watch-list').innerHTML, /正股蓄勢 · 待 CB 確認/);
  assert.match(elements.get('cb-watch-list').innerHTML, /CB 放量／價格：待資料/);
  assert.match(elements.get('cb-watch-count').textContent, /1 檔正股蓄勢/);
});

