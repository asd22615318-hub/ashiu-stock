let smcPeriod = '5';
let smcRequest = 0;
const smcCache = new Map();

function smcTime(unix) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(unix * 1000));
}

function smcBucket(unix, minutes) {
  const d = new Date(unix * 1000 + 8 * 3600000);
  const day = d.toISOString().slice(0, 10);
  const offset = d.getUTCHours() * 60 + d.getUTCMinutes() - 540;
  return `${day}:${Math.floor(offset / minutes)}`;
}

function smcAggregate(bars, minutes) {
  if (minutes === 5) return bars;
  const result = [];
  for (const bar of bars) {
    const key = smcBucket(bar.time, minutes);
    const last = result.at(-1);
    if (last?.key === key) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume += bar.volume;
    } else result.push({ ...bar, key });
  }
  return result;
}

function smcWeekly(bars) {
  const result = [];
  for (const bar of bars) {
    const date = new Date(`${bar.date}T04:00:00Z`);
    if (!Number.isFinite(date.getTime())) continue;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10);
    const last = result.at(-1);
    if (last?.key === key) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume += bar.volume;
    } else result.push({ ...bar, time: Math.floor(date.getTime() / 1000), key });
  }
  return result;
}

function smcLevels(bars) {
  const pivots = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const around = bars.slice(i - 2, i + 3);
    if (around.every((b, j) => j === 2 || bars[i].high > b.high)) pivots.push({ type: '壓力', price: bars[i].high, time: bars[i].time, index: i });
    if (around.every((b, j) => j === 2 || bars[i].low < b.low)) pivots.push({ type: '支撐', price: bars[i].low, time: bars[i].time, index: i });
  }
  const close = bars.at(-1).close;
  const supports = pivots.filter(p => p.price <= close).sort((a, b) => b.price - a.price || b.index - a.index);
  const resistances = pivots.filter(p => p.price >= close).sort((a, b) => a.price - b.price || b.index - a.index);
  return { supports: supports.slice(0, 2), resistances: resistances.slice(0, 2) };
}

function smcDraw(bars, period) {
  const el = document.getElementById('smc-chart');
  const weekly = period === 'week';
  const b = (weekly ? smcWeekly(bars) : smcAggregate(bars, Number(period))).slice(-90);
  if (b.length < 7) { el.innerHTML = '<p class="smc-empty">此週期分 K 資料不足，尚無法確認結構高低點。</p>'; return; }
  const { supports, resistances } = smcLevels(b);
  const levels = [...supports, ...resistances];
  const w = 900, h = 330, left = 18, right = 75, top = 20, bottom = 295;
  const high = Math.max(...b.map(x => x.high), ...levels.map(x => x.price));
  const low = Math.min(...b.map(x => x.low), ...levels.map(x => x.price));
  const pad = (high - low) * .08 || high * .01;
  const y = value => bottom - (value - low + pad) / (high - low + pad * 2) * (bottom - top);
  const step = (w - left - right) / b.length;
  let svg = '';
  for (let i = 0; i < 5; i++) {
    const price = low - pad + (high - low + pad * 2) * i / 4;
    svg += `<path d="M${left} ${y(price)}H${w - right}" stroke="#28394e" stroke-width="1"/><text x="${w - right + 8}" y="${y(price) + 4}" fill="#aebbc9" font-size="12">${fmt(price)}</text>`;
  }
  b.forEach((bar, i) => {
    const x = left + (i + .5) * step;
    const color = bar.close >= bar.open ? '#f36e7b' : '#5bd0ab';
    svg += `<g><title>${smcTime(bar.time)} 開 ${fmt(bar.open)} 高 ${fmt(bar.high)} 低 ${fmt(bar.low)} 收 ${fmt(bar.close)}</title><path d="M${x} ${y(bar.high)}V${y(bar.low)}" stroke="${color}"/><rect x="${x - step * .27}" y="${Math.min(y(bar.open), y(bar.close))}" width="${Math.max(2, step * .54)}" height="${Math.max(1.5, Math.abs(y(bar.open) - y(bar.close)))}" fill="${color}"/></g>`;
  });
  levels.forEach(p => {
    const color = p.type === '支撐' ? '#5bd0ab' : '#ffab65';
    svg += `<path d="M${left} ${y(p.price)}H${w - right}" stroke="${color}" stroke-width="1.8" stroke-dasharray="7 5"/><text x="${left + 4}" y="${Math.max(14, y(p.price) - 5)}" fill="${color}" font-size="13" paint-order="stroke" stroke="#101b2c" stroke-width="4">${p.type} ${fmt(p.price)}</text>`;
  });
  const latest = b.at(-1);
  svg += `<text x="${left}" y="${h - 9}" fill="#9eb0c0" font-size="12">${smcTime(b[0].time)}</text><text x="${w - right}" y="${h - 9}" text-anchor="end" fill="#9eb0c0" font-size="12">${smcTime(latest.time)}</text>`;
  el.innerHTML = `<div class="smc-summary"><span>最新 ${smcTime(latest.time)}</span><span>收盤 ${fmt(latest.close)}</span><span>支撐 ${supports.length ? supports.map(p => fmt(p.price)).join(' / ') : '未確認'}</span><span>壓力 ${resistances.length ? resistances.map(p => fmt(p.price)).join(' / ') : '未確認'}</span></div><div class="smc-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${weekly ? '週 K' : period + ' 分 K'} 與已確認結構支撐壓力線">${svg}</svg></div><p class="smc-note">線條依前後各 2 根 K 棒確認的結構高低點繪製；只列出目前價格附近各 2 條支撐與壓力。這是 SMC 結構參考，無法直接辨識機構實際買賣。${weekly ? '週 K 由網站日線資料合成，當週可能尚未收完。' : `資料來源：Yahoo Finance 近 5 日 5 分 K；${period} 分 K 由 5 分 K 合成，可能延遲。`}${levels.length ? '' : '目前沒有已確認且符合位置的結構線。'}</p>`;
}

async function renderSmcChart(stock) {
  const request = ++smcRequest;
  const el = document.getElementById('smc-chart');
  if (!el) return;
  el.innerHTML = '<p class="smc-empty">正在載入分 K 與結構線…</p>';
  document.querySelectorAll('[data-smc-period]').forEach(button => {
    button.classList.toggle('active', button.dataset.smcPeriod === smcPeriod);
    button.setAttribute('aria-pressed', String(button.dataset.smcPeriod === smcPeriod));
    button.onclick = () => { smcPeriod = button.dataset.smcPeriod; renderSmcChart(stock); };
  });
  if (smcPeriod === 'week') { smcDraw(stock.bars, smcPeriod); return; }
  const key = `${stock.code}:${stock.market}`;
  let data = smcCache.get(key);
  try {
    if (!data || Date.now() - data.loaded > 120000) {
      const response = await fetch(`/api/intraday?code=${encodeURIComponent(stock.code)}&market=${encodeURIComponent(stock.market)}`, { credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '分 K 載入失敗');
      data = { bars: body.bars || [], loaded: Date.now() };
      smcCache.set(key, data);
    }
    if (request !== smcRequest) return;
    smcDraw(data.bars, smcPeriod);
  } catch (error) {
    if (request === smcRequest) el.innerHTML = `<p class="smc-empty">${esc(error.message || '分 K 載入失敗')}。請稍後重試。</p>`;
  }
}

