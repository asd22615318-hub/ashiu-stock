const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
for (const id of ['cb-data-status', 'cb-data-panel', 'cb-data-period', 'cb-data-search', 'cb-data-rows', 'cb-watch-list', 'cb-watch-count', 'cb-watch-filter', 'cb-watch-search', 'cb-search-dialog', 'cb-search-results', 'cb-search-form', 'cb-search-close', 'cb-search-confirm']) {
  elements.set(id, {innerHTML: '', textContent: '', value: '', hidden: true, open: false, listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; }, querySelector() { return null; }, querySelectorAll() { return []; }, showModal() { this.open = true; }, close() { this.open = false; }, focus() {} });
}
elements.get('cb-watch-filter').value = 'watch';
const root = {innerHTML: '', querySelector(selector) { return elements.get(selector.slice(1)); }};
const bars = Array.from({length: 25}, (_, i) => ({date: `2026-09-${String(i + 1).padStart(2, '0')}`, open: 100, high: 101, low: 99, close: 100, volume: 1000}));
const stock = {code: '1234', name: '測試股', bars, t: bars.at(-1), score: 12};
const daily = Array.from({length: 21}, (_, i) => ({date: `2026-09-${String(i + 1).padStart(2, '0')}`, volume: i === 20 ? 400 : 100, close: 110}));
const data = {period: '2026-09', daily: {as_of: '2026-09-21', covered: 2, active: 2}, bonds: [{code: '12341', name: '測試一', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 110, conversion_price_kind: 'current_official', daily_bars: daily, custody: 100, change: 10}, {code: '12342', name: '測試二', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 130, conversion_price_kind: 'current_official', daily_bars: daily, custody: 90, change: 0}, {code: '12343', name: '測試三', underlying_code: '1234', maturity_date: '2028-01-01', conversion_price: 98, conversion_price_kind: 'current_official', daily_bars: daily, custody: 80, change: 0}]};
const context = {document: {getElementById() { return root; }}, window: {cbStockSnapshot() { return {mode: 'live', analyses: [stock]}; }, cbChipMetrics() { return {institutionalPercent: 2.4, institutionalDates: ['2026-09-01','2026-10-01'], holderDeltaPp: 1.25, holderDates: ['2026-09-04','2026-10-02']}; }, addEventListener() {}, dispatchEvent() {}}, fetch: async url => ({ok: true, json: async () => String(url).startsWith('cb-chip-data.json') ? {stocks: {}} : data}), Event: class {}, Intl, Date, Number, String, Array, Map, Math, Object, console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('convertible-radar.js', 'utf8'), context);
setImmediate(() => {
  assert.equal(context.window.convertibleDataStatus, 'ready');
  assert.equal(context.window.activeConvertibleBonds('1234').length, 3);
  assert.match(elements.get('cb-watch-list').innerHTML, /正股蓄勢/);
  assert.match(elements.get('cb-watch-list').innerHTML, /20 日量比 4.00 倍 · 異常放量/);
  assert.match(elements.get('cb-watch-list').innerHTML, /正股距離 <b>-9.1%<\/b>/);
  assert.match(elements.get('cb-watch-list').innerHTML, /站上 MA20/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /前 20 日高|未破 20 日高/);
  assert.match(elements.get('cb-watch-list').innerHTML, /均線分數 <b>12\/15<\/b>/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /三大法人近20日/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /集保大戶近4週/);
  assert.match(elements.get('cb-watch-list').innerHTML, /MA60 資料不足/);
  assert.match(elements.get('cb-watch-count').textContent, /1 檔／1 檔有 CB 正股/);
  const filter = elements.get('cb-watch-filter');
  filter.value = 'gap0to10'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /1234 測試股/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12342/);
  assert.match(elements.get('cb-watch-count').textContent, /1 檔低於轉換價 0～10%/);
  filter.value = 'gap11to20'; filter.listeners.change();
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12341/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12342/);
  filter.value = 'gap21to50'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /12342/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12341/);
  filter.value = 'gapAbove0to5'; filter.listeners.change();
  assert.match(elements.get('cb-watch-list').innerHTML, /12343/);
  assert.doesNotMatch(elements.get('cb-watch-list').innerHTML, /12341|12342/);
  assert.match(elements.get('cb-watch-count').textContent, /1 檔高於轉換價 0～5%/);
  assert.equal(context.window.cbVolumeSignals(daily).abnormal, true);
  assert.equal(context.window.cbVolumeSignals(daily).continuous, true);
  assert.equal(context.window.cbVolumeSignals(daily.slice(0, 10)).abnormal, null);
  const search = elements.get('cb-watch-search');
  search.value = '1234';
  assert.equal(elements.get('cb-search-dialog').open, false);
  elements.get('cb-search-form').listeners.submit({preventDefault() {}});
  assert.equal(elements.get('cb-search-dialog').open, true);
  assert.match(elements.get('cb-search-results').innerHTML, /12341/);
  assert.match(elements.get('cb-search-results').innerHTML, /目前轉換價 <b>110 元<\/b>/);
  assert.match(elements.get('cb-search-results').innerHTML, /正股收盤 <b>100<\/b>/);
  assert.match(elements.get('cb-search-results').innerHTML, /均線分數 <b>12\/15<\/b>/);
  elements.get('cb-search-close').listeners.click();
  assert.equal(elements.get('cb-search-dialog').open, false);
});


