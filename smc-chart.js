let smcPeriod = '5';
let smcZoom = 1;
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

function smcDaily(bars) {
  return bars.filter(bar => /^\d{4}-\d{2}-\d{2}$/.test(bar.date)).map(bar => ({ ...bar, time: Math.floor(Date.parse(`${bar.date}T04:00:00Z`) / 1000) }));
}

function smcLevels(bars) {
  const pivots = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const around = bars.slice(i - 2, i + 3);
    if (around.every((b, j) => j === 2 || bars[i].high > b.high)) pivots.push({ kind: 'high', price: bars[i].high, index: i });
    if (around.every((b, j) => j === 2 || bars[i].low < b.low)) pivots.push({ kind: 'low', price: bars[i].low, index: i });
  }
  const close = bars.at(-1).close;
  const candidates = pivots.map(p => {
    if (p.kind === 'low') return { ...p, type: p.price <= close ? '支撐' : '失守', start: p.index, breakout: -1 };
    let breakout = -1;
    for (let j = p.index + 3; j < bars.length; j++) {
      if (bars[j - 1].close <= p.price && bars[j].close > p.price) { breakout = j; break; }
    }
    return { ...p, type: breakout >= 0 && p.price <= close ? '支撐' : '壓力', start: breakout >= 0 ? breakout : p.index, breakout };
  });
  function distinct(list, limit) {
    const chosen = [];
    for (const p of list) {
      if (chosen.some(q => Math.abs(p.price - q.price) / Math.max(1, q.price) < .005)) continue;
      chosen.push(p);
      if (chosen.length === limit) break;
    }
    return chosen;
  }
  const supports = distinct(candidates.filter(p => p.type === '支撐').sort((a, b) => b.price - a.price || b.breakout - a.breakout), 6);
  const resistances = distinct(candidates.filter(p => p.type === '壓力' && p.price >= close).sort((a, b) => a.price - b.price || b.index - a.index), 3);
  return { supports, resistances };
}

function smcDraw(bars, period) {
  const el = document.getElementById('smc-chart');
  const weekly = period === 'week', daily = period === 'day';
  const b = (weekly ? smcWeekly(bars) : daily ? smcDaily(bars) : smcAggregate(bars, Number(period))).slice(-90);
  if (b.length < 7) { el.innerHTML = '<p class="smc-empty">此週期分 K 資料不足，尚無法確認結構高低點。</p>'; return; }
  const { supports, resistances } = smcLevels(b);
  const levels = [...supports, ...resistances];
  const w = 900 * smcZoom, h = 330, left = 54, right = 115, top = 20, bottom = 295;
  const high = Math.max(...b.map(x => x.high), ...levels.map(x => x.price));
  const low = Math.min(...b.map(x => x.low), ...levels.map(x => x.price));
  const pad = (high - low) * .08 || high * .01;
  const y = value => bottom - (value - low + pad) / (high - low + pad * 2) * (bottom - top);
  const step = (w - left - right) / b.length;
  let svg = '';
  for (let i = 0; i < 5; i++) {
    const price = low - pad + (high - low + pad * 2) * i / 4;
    svg += `<path d="M${left} ${y(price)}H${w - right}" stroke="#28394e" stroke-width="1"/><text x="${left - 8}" y="${y(price) + 4}" text-anchor="end" fill="#aebbc9" font-size="12">${fmt(price)}</text>`;
  }
  b.forEach((bar, i) => {
    const x = left + (i + .5) * step;
    const color = bar.close >= bar.open ? '#f36e7b' : '#5bd0ab';
    svg += `<g><title>${smcTime(bar.time)} 開 ${fmt(bar.open)} 高 ${fmt(bar.high)} 低 ${fmt(bar.low)} 收 ${fmt(bar.close)}</title><path d="M${x} ${y(bar.high)}V${y(bar.low)}" stroke="${color}"/><rect x="${x - step * .27}" y="${Math.min(y(bar.open), y(bar.close))}" width="${Math.max(2, step * .54)}" height="${Math.max(1.5, Math.abs(y(bar.open) - y(bar.close)))}" fill="${color}"/></g>`;
  });
  const labelPositions = [];
  levels.forEach(p => {
    const support = p.type === '支撐', color = support ? '#2a91ff' : '#ffab65';
    const startX = left + Math.max(0, p.start) * step;
    svg += support ? `<path d="M${startX} ${y(p.price) - 2}H${w - right}M${startX} ${y(p.price) + 2}H${w - right}" stroke="${color}" stroke-width="2"/>` : `<path d="M${startX} ${y(p.price)}H${w - right}" stroke="${color}" stroke-width="1.8" stroke-dasharray="7 5"/>`;
    let labelY = Math.max(16, Math.min(bottom - 4, y(p.price) + 4));
    while (labelPositions.some(other => Math.abs(other - labelY) < 17) && labelY > 20) labelY -= 17;
    labelPositions.push(labelY);
    svg += `<path d="M${w - right} ${y(p.price)}L${w - right + 7} ${labelY - 4}" stroke="${color}" stroke-width="1"/><text x="${w - right + 9}" y="${labelY}" fill="${support ? '#e6f1ff' : color}" font-size="12">${p.type} ${fmt(p.price)}</text>`;
    if (support && p.breakout >= 0) svg += `<text x="${left + (p.breakout + .5) * step}" y="${Math.max(14, y(p.price) - 8)}" fill="#e6f1ff" font-size="11" paint-order="stroke" stroke="#101b2c" stroke-width="4">突破</text>`;
  });
  const latest = b.at(-1);
  svg += `<text x="${left}" y="${h - 9}" fill="#9eb0c0" font-size="12">${smcTime(b[0].time)}</text><text x="${w - right}" y="${h - 9}" text-anchor="end" fill="#9eb0c0" font-size="12">${smcTime(latest.time)}</text>`;
  const label = weekly ? '週 K' : daily ? '日 K' : `${period} 分 K`;
  const source = weekly ? '週 K 由網站日線資料合成，當週可能尚未收完。' : daily ? '日 K 使用網站現有盤後行情。' : `資料來源：Yahoo Finance 近 5 日 5 分 K；${period} 分 K 由 5 分 K 合成，可能延遲。`;
  el.innerHTML = `<div class="smc-summary"><span>最新 ${weekly || daily ? latest.date || latest.key : smcTime(latest.time)}</span><span>收盤 ${fmt(latest.close)}</span><span>支撐 ${supports.length ? supports.map(p => fmt(p.price)).join(' / ') : '未確認'}</span><span>壓力 ${resistances.length ? resistances.map(p => fmt(p.price)).join(' / ') : '未確認'}</span></div><div class="smc-plot"><svg viewBox="0 0 ${w} ${h}" style="width:${smcZoom * 100}%;min-width:${600 * smcZoom}px" role="img" aria-label="${label} 與已確認結構支撐壓力線">${svg}</svg></div><p class="smc-note">藍色雙線為支撐：前後各 2 根 K 棒確認的波段低點，或收盤突破已確認前高後由壓力轉成的支撐；「突破」標在首次收盤站上前高的位置。跌回線下後不再標為支撐。橘色虛線為尚未突破的前高壓力。最多顯示 6 條支撐、3 條壓力；相近價位會合併。此為價格結構參考，無法直接辨識機構實際買賣。${source}${levels.length ? '' : '目前沒有已確認的結構線。'}</p>`;
  const plot = el.querySelector('.smc-plot');
  plot.scrollLeft = plot.scrollWidth - plot.clientWidth;
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
  document.querySelectorAll('[data-smc-zoom]').forEach(button => {
    button.onclick = () => {
      const action = button.dataset.smcZoom;
      smcZoom = action === 'reset' ? 1 : Math.max(1, Math.min(4, +(smcZoom + (action === 'in' ? .5 : -.5)).toFixed(1)));
      renderSmcChart(stock);
    };
    button.disabled = button.dataset.smcZoom === 'in' ? smcZoom >= 4 : button.dataset.smcZoom === 'out' ? smcZoom <= 1 : smcZoom === 1;
  });
  const zoomLabel = document.getElementById('smc-zoom-label');
  if (zoomLabel) zoomLabel.textContent = `${Math.round(smcZoom * 100)}%`;
  if (smcPeriod === 'week' || smcPeriod === 'day') { smcDraw(stock.bars, smcPeriod); return; }
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

