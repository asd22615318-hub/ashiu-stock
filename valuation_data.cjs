// Official TWSE / TPEx closing valuation ratios, saved for the protected site.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const sources = {
  listed: 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
  otc: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis',
};
const number = value => {
  const n = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};
const date = value => {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (raw.length !== 7) return null;
  const year = Number(raw.slice(0, 3)) + 1911;
  const iso = `${year}-${raw.slice(3, 5)}-${raw.slice(5, 7)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
};
async function fetchJson(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'AshiuPatternScreener/1.0'}});
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
async function main() {
  const [listed, otc] = await Promise.all([fetchJson(sources.listed), fetchJson(sources.otc)]);
  if (!Array.isArray(listed) || listed.length < 900 || !Array.isArray(otc) || otc.length < 700) throw Error('Official valuation feed is incomplete');
  const stocks = {};
  for (const [market, rows] of [['上市', listed], ['上櫃', otc]]) {
    for (const row of rows) {
      const code = String(market === '上市' ? row.Code : row.SecuritiesCompanyCode ?? '').trim();
      const day = date(row.Date);
      if (!/^\d{4}$/.test(code) || !day) continue;
      stocks[code] = {
        market,
        date: day,
        pe: number(market === '上市' ? row.PEratio : row.PriceEarningRatio),
        pb: number(market === '上市' ? row.PBratio : row.PriceBookRatio),
      };
    }
  }
  if (Object.keys(stocks).length < 1600) throw Error('Official valuation feed has too few valid stocks');
  const output = {updated_at: new Date().toISOString(), sources, stocks};
  const target = path.join(root, 'valuation-seed.json');
  const temporary = target + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(output));
  fs.renameSync(temporary, target);
  console.log(`Saved ${Object.keys(stocks).length} official valuation records`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
