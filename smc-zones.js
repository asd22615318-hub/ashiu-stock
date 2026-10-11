let smcZonePeriod = 'day';
let smcZoneRequest = 0;
const smcMinuteCache = new Map();

function smcTick(price) {
  return price < 10 ? .01 : price < 50 ? .05 : price < 100 ? .1 : price < 500 ? .5 : price < 1000 ? 1 : 5;
}

function smcStamp(time) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(time * 1000));
}

function smcClean(bars) {
  return bars.filter(b => [b.open, b.high, b.low, b.close].every(v => Number.isFinite(v) && v > 0) && b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close)).map(b => ({ ...b, volume: Number.isFinite(b.volume) ? b.volume : 0 }));
}

function smcWeekly(daily) {
  const output = [];
  for (const bar of daily) {
    const date = new Date(`${bar.date}T04:00:00Z`);
    if (!Number.isFinite(date.getTime())) continue;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10);
    const last = output.at(-1);
    if (last?.key === key) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume += bar.volume;
      last.date = bar.date;
    } else output.push({ ...bar, key });
  }
  return output;
}

function smcMinutes(bars, period) {
  if (period === 5) return bars;
  const output = [];
  for (const bar of bars) {
    const local = new Date(bar.time * 1000 + 8 * 3600000);
    const day = local.toISOString().slice(0, 10);
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes() - 540;
    const key = `${day}:${Math.floor(minute / period)}`;
    const last = output.at(-1);
    if (last?.key === key) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      last.volume += bar.volume;
    } else output.push({ ...bar, key });
  }
  return output;
}

function smcAtr(bars) {
  return bars.map((bar, i) => {
    if (i < 14) return null;
    let sum = 0;
    for (let j = i - 14; j < i; j++) {
      const prior = j ? bars[j - 1].close : bars[j].close;
      sum += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - prior), Math.abs(bars[j].low - prior));
    }
    return sum / 14;
  });
}

function smcSwings(bars, radius) {
  const highs = [], lows = [];
  for (let i = radius; i < bars.length - radius; i++) {
    let high = true, low = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) high = false;
      if (bars[j].low <= bars[i].low) low = false;
    }
    if (high) highs.push({ index: i, confirmed: i + radius, price: bars[i].high });
    if (low) lows.push({ index: i, confirmed: i + radius, price: bars[i].low });
  }
  return { highs, lows };
}

function smcAnalyze(raw, period) {
  const bars = smcClean(raw), radius = period === 'day' || period === 'week' ? 3 : period === '60' ? 4 : 5;
  if (bars.length < Math.max(22, radius * 2 + 6)) return { bars, zones: [], events: [], trend: '資料不足', period, radius, swings: { highs: [], lows: [] }, eq: null };
  const atr = smcAtr(bars), swings = smcSwings(bars, radius), zones = [], events = [];
  let high = null, low = null, trend = '未確認', brokenHigh = -1, brokenLow = -1;
  for (let i = 0; i < bars.length; i++) {
    for (const p of swings.highs.filter(x => x.confirmed === i)) {
      high = p;
      zones.push({ side: 'pressure', type: '結構高點', low: p.price - smcTick(p.price), high: p.price + smcTick(p.price), formed: p.index, created: i });
    }
    for (const p of swings.lows.filter(x => x.confirmed === i)) {
      low = p;
      zones.push({ side: 'support', type: '結構低點', low: p.price - smcTick(p.price), high: p.price + smcTick(p.price), formed: p.index, created: i });
    }
    const bar = bars[i], previous = i ? bars[i - 1] : null, delta = Math.max(smcTick(bar.close), (atr[i] || 0) * .05);
    if (previous && high && high.index > brokenHigh && previous.close <= high.price + delta && bar.close > high.price + delta) {
      const kind = trend === '空頭' ? 'CHoCH' : 'BOS';
      events.push({ kind, direction: '多', index: i, price: high.price });
      const displacement = atr[i] !== null && Math.abs(bar.close - bar.open) >= 1.2 * atr[i];
      if (displacement) {
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (bars[j].close < bars[j].open) { zones.push({ side: 'support', type: '多方 OB', low: bars[j].low, high: bars[j].high, formed: j, created: i }); break; }
        }
      }
      brokenHigh = high.index;
      trend = '多頭';
    }
    if (previous && low && low.index > brokenLow && previous.close >= low.price - delta && bar.close < low.price - delta) {
      const kind = trend === '多頭' ? 'CHoCH' : 'BOS';
      events.push({ kind, direction: '空', index: i, price: low.price });
      const displacement = atr[i] !== null && Math.abs(bar.close - bar.open) >= 1.2 * atr[i];
      if (displacement) {
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (bars[j].close > bars[j].open) { zones.push({ side: 'pressure', type: '空方 OB', low: bars[j].low, high: bars[j].high, formed: j, created: i }); break; }
        }
      }
      brokenLow = low.index;
      trend = '空頭';
    }
    if (i >= 2 && atr[i] !== null) {
      const upper = bars[i - 2].high, lower = bars[i - 2].low;
      if (bar.low - upper >= .1 * atr[i]) zones.push({ side: 'support', type: '多方 FVG', low: upper, high: bar.low, formed: i, created: i });
      if (lower - bar.high >= .1 * atr[i]) zones.push({ side: 'pressure', type: '空方 FVG', low: bar.high, high: lower, formed: i, created: i });
    }
    if (low && low.confirmed < i && bar.low < low.price - delta && bar.close > low.price) {
      const avg = i >= 20 ? bars.slice(i - 20, i).reduce((sum, b) => sum + b.volume, 0) / 20 : null;
      events.push({ kind: '掃低收回', direction: '多', index: i, price: low.price, volumeConfirmed: avg !== null && bar.volume >= 1.5 * avg });
    }
  }
  for (const z of zones) {
    let tests = 0, inside = false, invalidAt = null;
    for (let i = z.created + 1; i < bars.length; i++) {
      const bar = bars[i];
      if (z.side === 'support' ? bar.close < z.low : bar.close > z.high) { invalidAt = i; break; }
      const touches = bar.low <= z.high && bar.high >= z.low;
      if (touches && !inside) tests++;
      inside = touches;
    }
    z.tests = tests;
    z.invalidAt = invalidAt;
    z.status = invalidAt === null ? '有效' : '失效';
    z.period = period;
    z.formedAt = bars[z.formed]?.date || (bars[z.formed]?.time ? smcStamp(bars[z.formed].time) : '—');
  }
  const eq = high && low && high.price > low.price ? (high.price + low.price) / 2 : null;
  return { bars, zones, events, trend, period, radius, swings, eq };
}

function smcNearest(zones, close, side, count) {
  const active = zones.filter(z => z.status === '有效' && z.side === side && (side === 'support' ? z.low <= close : z.high >= close));
  active.sort((a, b) => {
    const ad = Math.abs(close - (a.low + a.high) / 2), bd = Math.abs(close - (b.low + b.high) / 2);
    return ad - bd || b.created - a.created;
  });
  const result = [];
  for (const z of active) {
    if (result.some(other => Math.max(z.low, other.low) <= Math.min(z.high, other.high) && z.type === other.type)) continue;
    result.push(z);
    if (result.length === count) break;
  }
  return result;
}

function smcCore(analyses, close) {
  const support = analyses.flatMap(a => a.zones).filter(z => z.status === '有效' && z.side === 'support' && z.low <= close && z.high >= close * .85);
  let best = null;
  for (let i = 0; i < support.length; i++) for (let j = i + 1; j < support.length; j++) {
    const a = support[i], b = support[j];
    if (a.period === b.period) continue;
    const low = Math.max(a.low, b.low), high = Math.min(a.high, b.high);
    if (low > high) continue;
    const candidate = { low, high, outerLow: Math.min(a.low, b.low), outerHigh: Math.max(a.high, b.high), sources: [a, b] };
    if (!best || Math.abs(close - high) < Math.abs(close - best.high)) best = candidate;
  }
  return best;
}

function smcSvg(analysis, displayed, core) {
  const bars = analysis.bars.slice(-72), offset = analysis.bars.length - bars.length;
  if (bars.length < 5) return '';
  const w = 920, h = 340, left = 16, right = 124, top = 18, bottom = 304, plotRight = w - right;
  const close = bars.at(-1).close;
  const visibleZones = displayed.filter(z => z.high >= Math.min(...bars.map(b => b.low)) * .9 && z.low <= Math.max(...bars.map(b => b.high)) * 1.1);
  const prices = bars.flatMap(b => [b.high, b.low]).concat(visibleZones.flatMap(z => [z.low, z.high]));
  if (core) prices.push(core.low, core.high);
  let low = Math.min(...prices), high = Math.max(...prices), pad = (high - low) * .07 || high * .01;
  low -= pad; high += pad;
  const y = v => bottom - (v - low) / (high - low) * (bottom - top), step = (plotRight - left) / bars.length;
  let svg = '';
  for (let i = 0; i < 4; i++) {
    const p = low + (high - low) * i / 3;
    svg += `<path d="M${left} ${y(p)}H${plotRight}" stroke="#253343" stroke-width="1"/><text x="${plotRight + 8}" y="${y(p) + 4}" fill="#9eacbb" font-size="12">${fmt(p)}</text>`;
  }
  for (const z of visibleZones) {
    const x = left + Math.max(0, z.created - offset) * step;
    const color = z.side === 'support' ? '#3baed6' : '#d678b4';
    const yy = y(z.high), height = Math.max(3, y(z.low) - yy);
    svg += `<rect x="${x}" y="${yy}" width="${plotRight - x}" height="${height}" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-opacity=".75" rx="2"><title>${z.type} ${fmt(z.low)}–${fmt(z.high)} · ${z.formedAt}</title></rect>`;
    svg += `<text x="${plotRight + 8}" y="${yy + 12}" fill="${color}" font-size="11">${z.side === 'support' ? '支' : '壓'} ${fmt(z.low)}–${fmt(z.high)}</text>`;
  }
  if (core) svg += `<rect x="${left}" y="${y(core.high)}" width="${plotRight - left}" height="${Math.max(3, y(core.low) - y(core.high))}" fill="#4ed9a3" fill-opacity=".16" stroke="#4ed9a3" stroke-width="1.2" stroke-dasharray="5 4"><title>跨週期核心共振 ${fmt(core.low)}–${fmt(core.high)}</title></rect>`;
  bars.forEach((bar, i) => {
    const x = left + (i + .5) * step, color = bar.close >= bar.open ? '#e6657d' : '#69c4a7';
    svg += `<g><title>${bar.date || smcStamp(bar.time)} 開 ${fmt(bar.open)} 高 ${fmt(bar.high)} 低 ${fmt(bar.low)} 收 ${fmt(bar.close)}</title><path d="M${x} ${y(bar.high)}V${y(bar.low)}" stroke="${color}"/><rect x="${x - step * .27}" y="${Math.min(y(bar.open), y(bar.close))}" width="${Math.max(2, step * .54)}" height="${Math.max(1.5, Math.abs(y(bar.open) - y(bar.close)))}" fill="${color}"/></g>`;
  });
  svg += `<path d="M${left} ${y(close)}H${plotRight}" stroke="#edb969" stroke-width="1.2" stroke-dasharray="3 5"/><text x="${plotRight + 8}" y="${y(close) - 5}" fill="#edb969" font-size="12" font-weight="700">現價 ${fmt(close)}</text>`;
  svg += `<text x="${left}" y="${h - 7}" fill="#9eacbb" font-size="11">${bars[0].date || smcStamp(bars[0].time)}</text><text x="${plotRight}" y="${h - 7}" text-anchor="end" fill="#9eacbb" font-size="11">${bars.at(-1).date || smcStamp(bars.at(-1).time)}</text>`;
  return `<div class="smc-zone-plot"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${analysis.period} K 棒及支撐壓力區間">${svg}</svg></div>`;
}

function smcRender(stock, minuteBars = null) {
  const el = document.getElementById('smc-zone-content');
  if (!el) return;
  const daily = smcAnalyze(stock.bars, 'day'), weekly = smcAnalyze(smcWeekly(stock.bars), 'week');
  const analyses = [daily, weekly];
  if (minuteBars) for (const n of [5, 15, 30, 60]) analyses.push(smcAnalyze(smcMinutes(minuteBars, n), String(n)));
  const selected = analyses.find(a => a.period === smcZonePeriod);
  if (!selected || selected.bars.length < 22) { el.innerHTML = '<p class="smc-zone-pending">此週期目前沒有足夠的 K 棒，無法確認結構與支撐壓力。</p>'; return; }
  const close = selected.bars.at(-1)?.close;
  if (!Number.isFinite(close)) { el.innerHTML = '<p>目前沒有足夠的 K 棒資料。</p>'; return; }
  const supports = smcNearest(selected.zones, close, 'support', 2), pressures = smcNearest(selected.zones, close, 'pressure', 1);
  const displayed = [...supports, ...pressures];
  const core = smcCore(analyses, close);
  const fmtRange = z => z ? `${fmt(z.low)}–${fmt(z.high)}` : '尚未確認';
  const allZones = analyses.flatMap(a => a.zones).sort((a, b) => (a.status === '有效' ? 0 : 1) - (b.status === '有效' ? 0 : 1) || Math.abs(close - (a.low + a.high) / 2) - Math.abs(close - (b.low + b.high) / 2));
  const rows = allZones.slice(0, 80);
  const sourceRows = rows.map(z => {
    const gap = z.side === 'support' ? (close / z.high - 1) * 100 : (z.low / close - 1) * 100;
    return `<tr><td>${z.period === 'day' ? '日 K' : z.period === 'week' ? '週 K' : z.period + ' 分 K'}</td><td>${z.type}</td><td>${fmtRange(z)}</td><td>${esc(z.formedAt)}</td><td>${z.tests}</td><td class="${z.status === '有效' ? 'valid' : 'invalid'}">${z.status}</td><td>${(gap >= 0 ? '+' : '') + fmt(gap)}%</td></tr>`;
  }).join('');
  const latestEvent = selected.events.at(-1);
  const signal = latestEvent && latestEvent.index >= selected.bars.length - 8 ? `${latestEvent.kind} ${latestEvent.direction}${latestEvent.kind === '掃低收回' && latestEvent.volumeConfirmed ? '（放量）' : ''} · ${selected.bars[latestEvent.index]?.date || smcStamp(selected.bars[latestEvent.index].time)}` : '近期無已確認結構訊號';
  el.innerHTML = `<div class="smc-zone-metrics"><span>結構方向<strong>${selected.trend}</strong></span><span>最近支撐<strong>${fmtRange(supports[0])}</strong></span><span>最近壓力<strong>${fmtRange(pressures[0])}</strong></span><span>核心共振<strong>${core ? fmt(core.low) + '–' + fmt(core.high) : '尚未形成'}</strong></span></div>${smcSvg(selected, displayed, core)}<p class="smc-zone-signal">${signal}${selected.eq !== null ? ` · EQ ${fmt(selected.eq)} · ${close < selected.eq ? '折價區' : '溢價區'}` : ''}</p><details class="smc-zone-sources"><summary>查看支撐壓力來源與失效紀錄（${rows.length} / ${allZones.length}）</summary><div class="smc-zone-table-wrap"><table><thead><tr><th>週期</th><th>來源</th><th>區間</th><th>形成時間</th><th>回測</th><th>狀態</th><th>距現價</th></tr></thead><tbody>${sourceRows}</tbody></table></div></details><p class="smc-zone-note">波段點需右側 K 棒完成才確認；日 K／週 K 用網站盤後資料，分 K 用近五日 5 分 K 合成。圖上只顯示目前週期最近兩個支撐與一個壓力，詳細來源不合併。區間是規則估算，非實際委託單或交易建議。</p>`;
}

async function renderSmcZones(stock) {
  const request = ++smcZoneRequest;
  document.querySelectorAll('[data-smc-zone-period]').forEach(button => {
    button.classList.toggle('active', button.dataset.smcZonePeriod === smcZonePeriod);
    button.setAttribute('aria-pressed', String(button.dataset.smcZonePeriod === smcZonePeriod));
    button.onclick = () => { smcZonePeriod = button.dataset.smcZonePeriod; renderSmcZones(stock); };
  });
  if (smcZonePeriod === 'day' || smcZonePeriod === 'week') { smcRender(stock, smcMinuteCache.get(`${stock.code}:${stock.market}`)?.bars); return; }
  const el = document.getElementById('smc-zone-content');
  el.innerHTML = '<p class="smc-zone-pending">正在載入分 K 資料…</p>';
  const key = `${stock.code}:${stock.market}`;
  let data = smcMinuteCache.get(key);
  try {
    if (!data || Date.now() - data.loaded > 120000) {
      const response = await fetch(`/api/intraday?code=${encodeURIComponent(stock.code)}&market=${encodeURIComponent(stock.market)}`, { credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '分 K 載入失敗');
      data = { bars: smcClean(body.bars || []), loaded: Date.now() };
      smcMinuteCache.set(key, data);
    }
    if (request === smcZoneRequest) smcRender(stock, data.bars);
  } catch (error) {
    if (request === smcZoneRequest) el.innerHTML = `<p class="smc-zone-pending">${esc(error.message || '分 K 載入失敗')}。日 K 與週 K 仍可查看。</p>`;
  }
}

