const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
for (const id of ['cb-data-status', 'cb-data-panel', 'cb-data-period', 'cb-data-search', 'cb-data-rows', 'cb-watch-list', 'cb-watch-count', 'cb-watch-filter', 'cb-watch-search']) {
  elements.set(id, {innerHTML: '', textContent: '', value: '', hidden: true, listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; }, querySelectorAll() { return []; }});
}
elements.get('cb-watch-filter').value = 'watch';
const root = {innerHTML: '', querySelector(selector) { return elements.get(selector.slice(1)); }};
const bars = Array.from({length: 25}, (_, i) => ({date: `2026-09-${String(i + 1).padStart(2, '0')}`, open: 100, high: 101, low: 99, close: 100, volume: 1000}));
const stock = {code: '1234', name: '測試股', bars, t: bars.at(-1)};
const daily = Array.from({length: 21}, (_, i) => ({date: `2026-09-${String(i + 1).padStart(2, '0')}`, volume: i === 20 ? 400 : 100, close: 110}));
const data = {period: '2026-09', daily: {as_of: '2026-09-21', covered: 2, active: 2}, bonds: [{code: '12341', name: '測試一', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 110, conversion_price_kind: 'current_official', daily_bars: daily, custody: 100, change: 10}, {code: '12342', name: '測試二', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 130, conversion_price_kind: 'current_official', daily_bars: daily, custody: 90, change: 0}]};
const context = {document: {getElementById() { return root; }}, window: {cbStockSnapshot() { return {mode: 'live', analyses: [stock]}; }, addEventListener() {}, dispatchEvent() {}}, fetch: async () => ({ok: true, json: async () => data}), Event: class {}, Intl, Date, Number, String, Array, Map, Math, Object, console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('convertible-radar.js', 'utf8'), context);
setImmediate(() => {
  assert.equal(context.window.convertibleDataStatus, 'ready');
  assert.equal(context.window.activeConvertibleBonds('1234').length, 2);
  assert.match(elements.get('cb-watch-list').innerHTML, /正股蓄勢/);
  assert.match(elements.get('cb-watch-list').innerHTML, /20 日量比 4.00 倍 · 異常放量/);
  assert.match(elements.get('cb-watch-list').innerHTML, /正股距離 -9.1%/);
  assert.match(elements.get('cb-watch-list').innerHTML, /站上 MA20/);
  assert.match(elements.get('cb-watch-list').innerHTML, /MA60 資料不足/);
  assert.match(elements.get('cb-watch-count').textContent, /1 檔低於轉換價 0～20%/);
  const filter = elements.get('cb-watch-filter');
  filter.value = 'below10'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /1234 測試股/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12342/);
  filter.value = 'below20'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /1234 測試股/);
  filter.value = 'below30'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /12342/);
  assert.equal(context.window.cbVolumeSignals(daily).abnormal, true);
  assert.equal(context.window.cbVolumeSignals(daily).continuous, true);
  assert.equal(context.window.cbVolumeSignals(daily.slice(0, 10)).abnormal, null);
});


