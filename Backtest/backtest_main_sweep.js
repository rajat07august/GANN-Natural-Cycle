#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_main_sweep.js — Main Dashboard (NIFTY50 + Midcap) Gann Confluence Backtest
//
// Rules (Long Only):
//   Entry  : First daily close > confHigh (after conf date)
//   SL     : Daily close < confLow → exit at that close
//   Exit   : Open of next confluence date (first trading day on/after)
//   Skip   : If no close > confHigh before next conf date → no trade
//
// Sweeps: Dev% ∈ {2,3,4,5,7,10} × Depth ∈ {5,8,10,12,15,20} = 36 combos
// Filter: ≥ 10 closed trades per stock+combo
// History: Full (from each stock's earliest available data)
// ─────────────────────────────────────────────────────────────────────

'use strict';
const fs   = require('fs');
const path = require('path');

const ADJ_DIR    = 'j:/Swing Trading/Swing Trading/processed_adj';
const OUT_FILE   = 'j:/GANN Claude/Backtest/backtest_main_sweep.html';
const GAPS       = [20,15,13,12,10,6,5,4,3,2,1];
const DEV_VALS   = [2,3,4,5,7,10];
const DEP_VALS   = [5,8,10,12,15,20];
const MIN_TRADES = 10;
const YEAR_START = 2000;
const YEAR_END   = 2026;
const TODAY      = new Date().toISOString().split('T')[0];

// ── Stock name lookup ─────────────────────────────────────────────────
const STOCK_NAMES = {
  // NIFTY50
  ADANIENT:'Adani Enterprises', ADANIPORTS:'Adani Ports',
  APOLLOHOSP:'Apollo Hospitals', ASIANPAINT:'Asian Paints',
  AXISBANK:'Axis Bank', 'BAJAJ-AUTO':'Bajaj Auto',
  BAJAJFINSV:'Bajaj Finserv', BAJFINANCE:'Bajaj Finance',
  BHARTIARTL:'Bharti Airtel', BPCL:'BPCL',
  BRITANNIA:'Britannia', CIPLA:'Cipla',
  COALINDIA:'Coal India', DRREDDY:"Dr. Reddy's",
  EICHERMOT:'Eicher Motors', GRASIM:'Grasim',
  HCLTECH:'HCL Technologies', HDFCBANK:'HDFC Bank',
  HDFCLIFE:'HDFC Life', HEROMOTOCO:'Hero MotoCorp',
  HINDALCO:'Hindalco', HINDUNILVR:'Hindustan Unilever',
  ICICIBANK:'ICICI Bank', INDUSINDBK:'IndusInd Bank',
  INFY:'Infosys', ITC:'ITC',
  JSWSTEEL:'JSW Steel', KOTAKBANK:'Kotak Mahindra Bank',
  LT:'Larsen & Toubro', 'M&M':'Mahindra & Mahindra',
  MARUTI:'Maruti Suzuki', NESTLEIND:'Nestle India',
  NTPC:'NTPC', ONGC:'ONGC',
  POWERGRID:'Power Grid', RELIANCE:'Reliance Industries',
  SBIN:'SBI', SHRIRAMFIN:'Shriram Finance',
  SUNPHARMA:'Sun Pharma', TATACONSUM:'Tata Consumer',
  TATAMOTORS:'Tata Motors', TATASTEEL:'Tata Steel',
  TCS:'TCS', TECHM:'Tech Mahindra',
  TITAN:'Titan', TRENT:'Trent',
  ULTRACEMCO:'UltraTech Cement', WIPRO:'Wipro',
  ZOMATO:'Zomato',
  // Midcap / FNO
  ADANIPOWER:'Adani Power', POONAWALLA:'Poonawalla Fincorp',
  SUZLON:'Suzlon Energy', FEDERALBNK:'Federal Bank',
  PERSISTENT:'Persistent Systems', COFORGE:'Coforge',
  CANBK:'Canara Bank', SAIL:'SAIL',
  NMDC:'NMDC', RVNL:'RVNL',
  IRFC:'IRFC', MCX:'MCX India',
  NATIONALUM:'National Aluminium', INDHOTEL:'Indian Hotels',
  LTTS:'L&T Technology Services', MFSL:'Max Financial Services',
  HUDCO:'HUDCO', SRF:'SRF',
  POLYCAB:'Polycab India', NHPC:'NHPC',
  SJVN:'SJVN', GMRINFRA:'GMR Airports',
  CONCOR:'Container Corporation', COCHINSHIP:'Cochin Shipyard',
  MAZDOCK:'Mazagon Dock',
  // Additional
  BHEL:'Bharat Heavy Electricals',
  BANDHANBNK:'Bandhan Bank', BANKBARODA:'Bank of Baroda',
  BANKINDIA:'Bank of India', CUB:'City Union Bank',
  DHANBANK:'Dhanlaxmi Bank', RBLBANK:'RBL Bank',
  DLF:'DLF', OBEROIRLTY:'Oberoi Realty',
  GODREJPROP:'Godrej Properties',
};

// ── Load OHLC from processed_adj CSV ─────────────────────────────────
function loadOHLC(sym) {
  const fpath = path.join(ADJ_DIR, sym + '.csv');
  if (!fs.existsSync(fpath)) return [];
  const lines = fs.readFileSync(fpath, 'utf8').trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < 6) continue;
    const o = parseFloat(c[2]), h = parseFloat(c[3]);
    const l = parseFloat(c[4]), cl = parseFloat(c[5]);
    if (!h || !l || h <= 0 || l <= 0) continue;
    rows.push({ date: c[1].trim(), open: o, high: h, low: l, close: cl });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// ── ZigZag ───────────────────────────────────────────────────────────
function computeZigZag(rows, dev, dep) {
  const pivots = [];
  if (!rows || rows.length < dep + 1) return pivots;
  let trend = null;
  let lhP = rows[0].high, lhD = rows[0].date, lhI = 0;
  let llP = rows[0].low,  llD = rows[0].date, llI = 0;
  for (let i = 1; i < rows.length; i++) {
    const { date, high, low } = rows[i];
    if (trend === null || trend === 'UP') {
      if (high >= lhP) { lhP = high; lhD = date; lhI = i; }
      if (low <= lhP * (1 - dev / 100) && (i - lhI) >= dep) {
        pivots.push({ date: lhD, type: 'H', price: lhP });
        trend = 'DOWN'; llP = low; llD = date; llI = i;
        for (let j = lhI + 1; j <= i; j++)
          if (rows[j].low < llP) { llP = rows[j].low; llD = rows[j].date; llI = j; }
      }
    }
    if (trend === 'DOWN') {
      if (low <= llP) { llP = low; llD = date; llI = i; }
      if (high >= llP * (1 + dev / 100) && (i - llI) >= dep) {
        pivots.push({ date: llD, type: 'L', price: llP });
        trend = 'UP'; lhP = high; lhD = date; lhI = i;
        for (let j = llI + 1; j <= i; j++)
          if (rows[j].high > lhP) { lhP = rows[j].high; lhD = rows[j].date; lhI = j; }
      }
    }
  }
  if (trend === 'UP')        pivots.push({ date: lhD, type: 'H', price: lhP });
  else if (trend === 'DOWN') pivots.push({ date: llD, type: 'L', price: llP });
  return pivots;
}

// ── Gann matrix ───────────────────────────────────────────────────────
function buildMatrix(pivots) {
  const m = {};
  pivots.forEach(({ date, type }) => {
    const yr = +date.substring(0, 4);
    const mi = +date.substring(5, 7) - 1;
    const dd = date.substring(8, 10);
    if (!m[yr]) m[yr] = Array.from({ length: 12 }, () => []);
    m[yr][mi].push({ day: dd, type });
  });
  return m;
}

// ── Binary search: first index with date >= target ────────────────────
function lowerBound(rows, target) {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].date < target) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// ── Build sorted list of all confluence dates ─────────────────────────
function getAllConfDates(matrix, rows) {
  const confs = [];
  for (let Y = YEAR_START; Y <= YEAR_END; Y++) {
    for (let M = 0; M < 12; M++) {
      const lookback = GAPS.map(g => Y - g);
      const freq = {};
      lookback.forEach(yr => {
        const yd = matrix[yr];
        if (!yd || !yd[M]) return;
        yd[M].forEach(({ day }) => {
          if (!freq[day]) freq[day] = 0;
          freq[day]++;
        });
      });
      Object.entries(freq).forEach(([day, count]) => {
        if (count < 2) return;
        const nominalDate = `${Y}-${String(M + 1).padStart(2, '0')}-${day}`;
        const idx = lowerBound(rows, nominalDate);
        if (idx >= rows.length) return;
        const row = rows[idx];
        if (!row || row.high <= 0 || row.low <= 0) return;
        confs.push({
          nominalDate,
          date:  row.date,
          high:  row.high,
          low:   row.low,
          count,
        });
      });
    }
  }
  confs.sort((a, b) => a.date.localeCompare(b.date) || a.nominalDate.localeCompare(b.nominalDate));
  const seen = new Set();
  return confs.filter(c => {
    if (seen.has(c.date)) return false;
    seen.add(c.date);
    return true;
  });
}

// ── Run backtest ──────────────────────────────────────────────────────
function runBacktest(rows, confDates) {
  const trades = [];
  for (let ci = 0; ci < confDates.length; ci++) {
    const conf     = confDates[ci];
    const nextConf = confDates[ci + 1] || null;
    const confHigh = conf.high;
    const confLow  = conf.low;
    if (confHigh <= confLow || confLow <= 0) continue;

    const endDate = nextConf ? nextConf.date : '2099-12-31';

    // Find entry: first close > confHigh strictly after conf date
    let entry = null;
    const startIdx = lowerBound(rows, conf.date) + 1;
    for (let j = startIdx; j < rows.length; j++) {
      if (rows[j].date >= endDate) break;
      if (rows[j].close > confHigh) {
        entry = { date: rows[j].date, price: rows[j].close };
        break;
      }
    }
    if (!entry) continue;

    const sl   = confLow;
    const risk = entry.price - sl;
    if (risk <= 0) continue;

    // Monitor from day after entry
    let exitPrice = null, exitDate = null, exitReason = null;
    const monIdx = lowerBound(rows, entry.date) + 1;
    for (let j = monIdx; j < rows.length; j++) {
      const row = rows[j];
      if (nextConf && row.date >= nextConf.date) {
        exitPrice  = row.open;
        exitDate   = row.date;
        exitReason = 'next_cf';
        break;
      }
      if (row.close < sl) {
        exitPrice  = row.close;
        exitDate   = row.date;
        exitReason = 'sl';
        break;
      }
    }
    if (!exitPrice || !exitDate) continue;
    if (exitDate >= TODAY) continue;

    const rMult = (exitPrice - entry.price) / risk;
    trades.push({
      confDate: conf.date, confHigh, confLow,
      entryDate: entry.date, entryPrice: entry.price,
      exitDate, exitPrice, exitReason, risk,
      rMult: Math.round(rMult * 100) / 100,
    });
  }
  return trades;
}

// ── Compute stats ─────────────────────────────────────────────────────
function computeStats(trades) {
  const n = trades.length;
  if (!n) return null;
  const wins   = trades.filter(t => t.rMult > 0).length;
  const totalR = trades.reduce((s, t) => s + t.rMult, 0);
  const avgR   = totalR / n;
  let peak = 0, equity = 0, maxDD = 0;
  trades.forEach(t => {
    equity += t.rMult;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  });
  const calmar = maxDD > 0 ? +(totalR / maxDD).toFixed(2) : +totalR.toFixed(2);
  return {
    n, wins, winRate: +(wins / n * 100).toFixed(1),
    avgR: +avgR.toFixed(2), totalR: +totalR.toFixed(2),
    calmar, maxDD: +maxDD.toFixed(2),
  };
}

// ── Main ──────────────────────────────────────────────────────────────
console.error('Loading OHLC from processed_adj/...');
const ALL_SYMS = fs.readdirSync(ADJ_DIR)
  .filter(f => f.endsWith('.csv'))
  .map(f => f.replace('.csv', ''))
  .sort();

const RESULTS = {};
let done = 0;

for (const sym of ALL_SYMS) {
  const rows = loadOHLC(sym);
  if (rows.length < 200) { done++; continue; }

  const symRes = { best: null, combos: [] };

  for (const dev of DEV_VALS) {
    for (const dep of DEP_VALS) {
      const pivots    = computeZigZag(rows, dev, dep);
      const matrix    = buildMatrix(pivots);
      const confDates = getAllConfDates(matrix, rows);
      const trades    = runBacktest(rows, confDates);

      if (trades.length < MIN_TRADES) {
        symRes.combos.push({ dev, dep, stats: null });
        continue;
      }
      const stats = computeStats(trades);
      symRes.combos.push({ dev, dep, stats, trades });

      if (!symRes.best || stats.calmar > symRes.best.stats.calmar) {
        symRes.best = { dev, dep, stats, trades };
      }
    }
  }

  if (symRes.best) RESULTS[sym] = symRes;
  done++;
  process.stderr.write(`  [${done}/${ALL_SYMS.length}] ${sym} — ${symRes.best ? `best Calmar ${symRes.best.stats.calmar} (dev${symRes.best.dev} dep${symRes.best.dep})` : 'no qualifying combo'}\n`);
}

// ── Export best combo per stock as compact JSON ───────────────────────
const bestCombos = {};
for (const [sym, res] of Object.entries(RESULTS)) {
  if (!res.best) continue;
  bestCombos[sym] = {
    dev: res.best.dev,
    dep: res.best.dep,
    n:   res.best.stats.n,
    w:   res.best.stats.winRate,
  };
}
const jsonPath = path.join(__dirname, 'best_combos_main.json');
fs.writeFileSync(jsonPath, JSON.stringify(bestCombos, null, 2), 'utf8');
console.error(`Best combos written → ${jsonPath} (${Object.keys(bestCombos).length} stocks)`);

// ── Aggregates for heatmap ────────────────────────────────────────────
const heatmap = {};
for (const sym of Object.keys(RESULTS)) {
  for (const combo of RESULTS[sym].combos) {
    if (!combo.stats) continue;
    const key = `${combo.dev}|${combo.dep}`;
    if (!heatmap[key]) heatmap[key] = { sum: 0, count: 0 };
    heatmap[key].sum   += combo.stats.calmar;
    heatmap[key].count += 1;
  }
}

// ── Embed data in HTML ────────────────────────────────────────────────
const summaryData = {};
for (const [sym, res] of Object.entries(RESULTS)) {
  summaryData[sym] = {
    name: STOCK_NAMES[sym] || sym,
    best: res.best ? {
      dev: res.best.dev, dep: res.best.dep,
      ...res.best.stats,
      trades: res.best.trades,
    } : null,
    combos: res.combos.map(c => ({
      dev: c.dev, dep: c.dep,
      stats: c.stats,
    })),
  };
}

const heatmapData = {};
for (const [key, v] of Object.entries(heatmap)) {
  heatmapData[key] = { avg: +(v.sum / v.count).toFixed(2), count: v.count };
}

console.error(`\nBuilding HTML...`);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Main Dashboard — Gann Backtest Sweep</title>
<style>
:root{--bg:#0d1117;--panel:#161b22;--panel2:#1c2128;--border:#30363d;
--text:#e6edf3;--sub:#8b949e;--accent:#58a6ff;--green:#3fb950;--red:#f85149;
--orange:#e3b341;--conf:#f0883e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px}
.hdr{background:var(--panel);border-bottom:1px solid var(--border);padding:14px 20px 0;position:sticky;top:0;z-index:100}
.title{font-size:18px;font-weight:700;margin-bottom:4px}
.title span{font-size:12px;font-weight:400;color:var(--sub);margin-left:8px}
.tab-nav{display:flex;gap:2px;margin-top:10px}
.tab-btn{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--sub);cursor:pointer;font-size:13px;padding:8px 18px;transition:.15s}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.tab-content{display:none;padding:20px}
.tab-content.active{display:block}
.ctrl-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;margin-bottom:16px}
.ctrl{display:flex;flex-direction:column;gap:4px}
.ctrl label{color:var(--sub);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.ctrl select,.ctrl input{background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;padding:5px 10px;outline:none}
.ctrl input{width:80px}
table{border-collapse:collapse;width:100%}
th{background:var(--panel2);border:1px solid var(--border);color:var(--sub);font-size:10px;font-weight:700;letter-spacing:.5px;padding:8px 10px;text-align:left;text-transform:uppercase;cursor:pointer;white-space:nowrap}
th:hover{color:var(--text)}
td{border:1px solid var(--border);padding:7px 10px;vertical-align:middle}
tr:hover td{background:var(--panel2)}
.pos{color:var(--green)}.neg{color:var(--red)}.neu{color:var(--sub)}
.badge{border-radius:4px;font-size:10px;padding:2px 7px;font-weight:700;white-space:nowrap}
.bg{background:rgba(63,185,80,.15);color:#3fb950;border:1px solid rgba(63,185,80,.3)}
.br{background:rgba(248,81,73,.15);color:#f85149;border:1px solid rgba(248,81,73,.3)}
.bo{background:rgba(227,179,65,.15);color:#e3b341;border:1px solid rgba(227,179,65,.3)}
.detail-btn{background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--sub);cursor:pointer;font-size:10px;padding:2px 8px}
.detail-btn:hover{color:var(--accent);border-color:var(--accent)}
.hmap-wrap{overflow-x:auto;margin-top:12px}
.hmap{border-collapse:collapse}
.hmap th,.hmap td{border:1px solid var(--border);padding:6px 12px;text-align:center;font-size:12px}
.hmap th{background:var(--panel2);color:var(--sub);font-size:10px}
.hmap .corner{background:var(--panel2)}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;width:96vw;max-width:1100px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column}
.modal-hdr{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.modal-hdr h2{font-size:15px;font-weight:700}
.modal-close{background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--sub);cursor:pointer;font-size:16px;padding:3px 10px}
.modal-body{overflow-y:auto;padding:16px}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:16px}
.stat-card{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 12px;text-align:center}
.stat-card .sv{font-size:18px;font-weight:700;margin-bottom:2px}
.stat-card .sl{font-size:10px;color:var(--sub);text-transform:uppercase}
.trades-tbl th,.trades-tbl td{padding:5px 8px;font-size:11px}
</style>
</head>
<body>
<div class="hdr">
  <div class="title">Main Dashboard — Gann Confluence Backtest <span>Dev% × Depth sweep · ${Object.keys(RESULTS).length} qualifying stocks · Full history</span></div>
  <nav class="tab-nav">
    <button class="tab-btn active" onclick="switchTab('summary',this)">Best Per Stock</button>
    <button class="tab-btn" onclick="switchTab('byparam',this)">By Param Combo</button>
    <button class="tab-btn" onclick="switchTab('heatmap',this)">Param Heatmap</button>
  </nav>
</div>

<div id="detail-modal" class="modal-overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal-box">
    <div class="modal-hdr">
      <h2 id="modal-title">—</h2>
      <button class="modal-close" onclick="closeModal()">&#x2715;</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>

<!-- TAB 1: Best Per Stock -->
<div id="tab-summary" class="tab-content active">
  <div class="ctrl-row">
    <div class="ctrl"><label>Min Trades</label><input type="number" id="s-min-trades" value="10" min="1" oninput="renderSummary()"></div>
    <div class="ctrl"><label>Min Calmar</label><input type="number" id="s-min-calmar" value="-99" oninput="renderSummary()"></div>
    <div class="ctrl"><label>Min Total R</label><input type="number" id="s-min-totalr" value="-99" oninput="renderSummary()"></div>
    <div class="ctrl"><label>Filter Name</label><input type="text" id="s-search" placeholder="Search..." oninput="renderSummary()" style="width:140px"></div>
  </div>
  <div id="summary-wrap" style="overflow-x:auto"></div>
</div>

<!-- TAB 2: By Param -->
<div id="tab-byparam" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Dev% × Depth</label>
      <select id="bp-combo" onchange="renderByParam()">
        ${DEV_VALS.flatMap(d => DEP_VALS.map(p => `<option value="${d}|${p}">Dev ${d}% · Depth ${p}</option>`)).join('')}
      </select>
    </div>
    <div class="ctrl"><label>Min Trades</label><input type="number" id="bp-min-trades" value="10" min="1" oninput="renderByParam()"></div>
    <div class="ctrl"><label>Min Calmar</label><input type="number" id="bp-min-calmar" value="-99" oninput="renderByParam()"></div>
  </div>
  <div id="byparam-wrap" style="overflow-x:auto"></div>
</div>

<!-- TAB 3: Heatmap -->
<div id="tab-heatmap" class="tab-content">
  <p style="color:var(--sub);font-size:12px;margin-bottom:14px">Average Calmar ratio across all qualifying stocks (≥${MIN_TRADES} trades) for each Dev%×Depth combination. Darker green = better.</p>
  <div class="hmap-wrap" id="heatmap-wrap"></div>
</div>

<script>
const DATA = ${JSON.stringify(summaryData)};
const HMAP = ${JSON.stringify(heatmapData)};
const DEV_VALS = ${JSON.stringify(DEV_VALS)};
const DEP_VALS = ${JSON.stringify(DEP_VALS)};
const MIN_TRADES = ${MIN_TRADES};

function switchTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
  if (id === 'summary') renderSummary();
  else if (id === 'byparam') renderByParam();
  else if (id === 'heatmap') renderHeatmap();
}

function fR(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + 'R'; }
function fC(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2); }
function cls(v) { return v > 0 ? 'pos' : v < 0 ? 'neg' : 'neu'; }
function badge(v) {
  if (v == null) return '';
  if (v >= 1.5) return \`<span class="badge bg">\${fC(v)}</span>\`;
  if (v >= 0)   return \`<span class="badge bo">\${fC(v)}</span>\`;
  return \`<span class="badge br">\${fC(v)}</span>\`;
}

let _sortCol = 'calmar', _sortDir = -1;
function sortBy(col) {
  if (_sortCol === col) _sortDir *= -1; else { _sortCol = col; _sortDir = -1; }
  renderSummary();
}

function renderSummary() {
  const minT = +document.getElementById('s-min-trades').value || 10;
  const minC = +document.getElementById('s-min-calmar').value || -99;
  const minR = +document.getElementById('s-min-totalr').value || -99;
  const q    = document.getElementById('s-search').value.toLowerCase();

  let rows = Object.entries(DATA)
    .filter(([sym, d]) => d.best && d.best.n >= minT && d.best.calmar >= minC && d.best.totalR >= minR)
    .filter(([sym, d]) => !q || sym.toLowerCase().includes(q) || (d.name||'').toLowerCase().includes(q));

  rows.sort(([,a],[,b]) => {
    const av = a.best[_sortCol] ?? -9999, bv = b.best[_sortCol] ?? -9999;
    return (bv - av) * _sortDir;
  });

  const th = (col, label) =>
    \`<th onclick="sortBy('\${col}')">\${label}\${_sortCol===col?(_sortDir<0?' ▼':' ▲'):''}</th>\`;

  const wrap = document.getElementById('summary-wrap');
  if (!rows.length) { wrap.innerHTML = '<p style="color:var(--sub);padding:20px">No stocks match filters.</p>'; return; }

  wrap.innerHTML = \`<table>
    <thead><tr>
      \${th('sym','Stock')}
      <th>Name</th>
      \${th('dev','Dev%')}
      \${th('dep','Depth')}
      \${th('n','Trades')}
      \${th('winRate','Win%')}
      \${th('avgR','Avg R')}
      \${th('totalR','Total R')}
      \${th('calmar','Calmar')}
      \${th('maxDD','Max DD')}
      <th>Detail</th>
    </tr></thead>
    <tbody>\${rows.map(([sym, d]) => {
      const b = d.best;
      return \`<tr>
        <td style="font-weight:700">\${sym}</td>
        <td style="color:var(--sub);font-size:11px">\${d.name||''}</td>
        <td>\${b.dev}%</td>
        <td>\${b.dep}</td>
        <td>\${b.n}</td>
        <td class="\${cls(b.winRate-50)}">\${b.winRate}%</td>
        <td class="\${cls(b.avgR)}">\${fR(b.avgR)}</td>
        <td class="\${cls(b.totalR)}">\${fR(b.totalR)}</td>
        <td>\${badge(b.calmar)}</td>
        <td class="neg">\${fR(-b.maxDD)}</td>
        <td><button class="detail-btn" onclick="openDetail('\${sym}')">&#x1F4CA; Detail</button></td>
      </tr>\`;
    }).join('')}
    </tbody>
  </table>\`;
}

function renderByParam() {
  const [devS, depS] = document.getElementById('bp-combo').value.split('|');
  const dev = +devS, dep = +depS;
  const minT = +document.getElementById('bp-min-trades').value || 10;
  const minC = +document.getElementById('bp-min-calmar').value || -99;

  let rows = Object.entries(DATA)
    .map(([sym, d]) => {
      const c = d.combos.find(x => x.dev === dev && x.dep === dep);
      if (!c || !c.stats || c.stats.n < minT || c.stats.calmar < minC) return null;
      return [sym, d.name||sym, c.stats];
    })
    .filter(Boolean)
    .sort((a, b) => b[2].calmar - a[2].calmar);

  const wrap = document.getElementById('byparam-wrap');
  if (!rows.length) { wrap.innerHTML = '<p style="color:var(--sub);padding:20px">No stocks qualify for this param combo.</p>'; return; }

  wrap.innerHTML = \`<table>
    <thead><tr>
      <th>Stock</th><th>Name</th><th>Trades</th><th>Win%</th>
      <th>Avg R</th><th>Total R</th><th>Calmar</th><th>Max DD</th>
      <th>Detail</th>
    </tr></thead>
    <tbody>\${rows.map(([sym, name, s]) => \`<tr>
      <td style="font-weight:700">\${sym}</td>
      <td style="color:var(--sub);font-size:11px">\${name}</td>
      <td>\${s.n}</td>
      <td class="\${cls(s.winRate-50)}">\${s.winRate}%</td>
      <td class="\${cls(s.avgR)}">\${fR(s.avgR)}</td>
      <td class="\${cls(s.totalR)}">\${fR(s.totalR)}</td>
      <td>\${badge(s.calmar)}</td>
      <td class="neg">\${fR(-s.maxDD)}</td>
      <td><button class="detail-btn" onclick="openDetail('\${sym}')">&#x1F4CA; Detail</button></td>
    </tr>\`).join('')}
    </tbody>
  </table>\`;
}

function renderHeatmap() {
  const vals = Object.values(HMAP).map(v => v.avg).filter(v => v != null);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  function cell(dev, dep) {
    const v = HMAP[\`\${dev}|\${dep}\`];
    if (!v) return '<td style="color:var(--border)">—</td>';
    const t = mx > mn ? (v.avg - mn) / (mx - mn) : 0.5;
    const r = Math.round(63 + (248-63)*(1-t)), g = Math.round(185 + (81-185)*(1-t));
    const bg = \`rgba(\${r},\${g},80,0.25)\`;
    const col = v.avg >= 0 ? '#3fb950' : '#f85149';
    return \`<td style="background:\${bg};color:\${col};font-weight:700">
      \${v.avg >= 0 ? '+' : ''}\${v.avg.toFixed(2)}<br><span style="font-size:9px;color:var(--sub)">n=\${v.count}</span>
    </td>\`;
  }
  document.getElementById('heatmap-wrap').innerHTML = \`<table class="hmap">
    <thead><tr><th class="corner">Dev \\ Depth</th>
      \${DEP_VALS.map(d => \`<th>\${d}</th>\`).join('')}
    </tr></thead>
    <tbody>\${DEV_VALS.map(dev =>
      \`<tr><th>\${dev}%</th>\${DEP_VALS.map(dep => cell(dev, dep)).join('')}</tr>\`
    ).join('')}
    </tbody>
  </table>\`;
}

function openDetail(sym) {
  const d = DATA[sym];
  if (!d) return;
  document.getElementById('modal-title').textContent = sym + ' — ' + (d.name||'') + ' · All Param Combos';

  let gridHTML = \`<table class="hmap" style="margin-bottom:20px">
    <thead><tr><th class="corner">Dev \\ Dep</th>\${DEP_VALS.map(p=>\`<th>\${p}</th>\`).join('')}</tr></thead>
    <tbody>\${DEV_VALS.map(dev => {
      return \`<tr><th>\${dev}%</th>\${DEP_VALS.map(dep => {
        const c = d.combos.find(x=>x.dev===dev&&x.dep===dep);
        if (!c||!c.stats) return \`<td style="color:var(--border)">—</td>\`;
        const s = c.stats;
        const col = s.calmar >= 1.5 ? '#3fb950' : s.calmar >= 0 ? '#e3b341' : '#f85149';
        return \`<td style="color:\${col};cursor:pointer" onclick="showTrades('\${sym}',\${dev},\${dep})">
          \${s.calmar>=0?'+':''}\${s.calmar.toFixed(2)}<br>
          <span style="font-size:9px;color:var(--sub)">n=\${s.n} \${fR(s.totalR)}</span>
        </td>\`;
      }).join('')}</tr>\`;
    }).join('')}
    </tbody>
  </table>\`;

  let tradeHTML = '';
  if (d.best) {
    const b = d.best;
    tradeHTML = \`<h3 style="font-size:12px;color:var(--sub);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">
      Best Combo: Dev \${b.dev}% · Depth \${b.dep} · Calmar \${b.calmar>=0?'+':''}\${b.calmar}
    </h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="sv">\${b.n}</div><div class="sl">Trades</div></div>
      <div class="stat-card"><div class="sv \${cls(b.winRate-50)}">\${b.winRate}%</div><div class="sl">Win Rate</div></div>
      <div class="stat-card"><div class="sv \${cls(b.avgR)}">\${fR(b.avgR)}</div><div class="sl">Avg R</div></div>
      <div class="stat-card"><div class="sv \${cls(b.totalR)}">\${fR(b.totalR)}</div><div class="sl">Total R</div></div>
      <div class="stat-card"><div class="sv \${cls(b.calmar)}">\${badge(b.calmar)}</div><div class="sl">Calmar</div></div>
      <div class="stat-card"><div class="sv neg">\${fR(-b.maxDD)}</div><div class="sl">Max DD</div></div>
    </div>
    <table class="trades-tbl">
      <thead><tr>
        <th>Conf Date</th><th>Conf High</th><th>Conf Low</th>
        <th>Entry Date</th><th>Entry</th><th>Exit Date</th><th>Exit</th>
        <th>Reason</th><th>Risk</th><th>rMult</th>
      </tr></thead>
      <tbody>\${b.trades.map(t => \`<tr>
        <td>\${t.confDate}</td>
        <td>\${t.confHigh.toFixed(2)}</td>
        <td>\${t.confLow.toFixed(2)}</td>
        <td>\${t.entryDate}</td>
        <td>\${t.entryPrice.toFixed(2)}</td>
        <td>\${t.exitDate}</td>
        <td>\${t.exitPrice.toFixed(2)}</td>
        <td style="color:\${t.exitReason==='sl'?'#f85149':'#8b949e'}">\${t.exitReason}</td>
        <td>\${t.risk.toFixed(2)}</td>
        <td class="\${cls(t.rMult)}" style="font-weight:700">\${fR(t.rMult)}</td>
      </tr>\`).join('')}
      </tbody>
    </table>\`;
  }

  document.getElementById('modal-body').innerHTML = gridHTML + tradeHTML;
  document.getElementById('detail-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function showTrades(sym, dev, dep) {
  const d = DATA[sym];
  if (!d || !d.best) return;
  if (d.best.dev === dev && d.best.dep === dep) return;
  const c = d.combos.find(x => x.dev===dev && x.dep===dep);
  if (c && c.stats) alert(\`Dev \${dev}% Depth \${dep}: \${c.stats.n} trades, Calmar \${c.stats.calmar>=0?'+':''}\${c.stats.calmar}. Full trade list available for best combo only.\`);
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

renderSummary();
</script>
</body>
</html>`;

fs.writeFileSync(OUT_FILE, html, 'utf8');
console.error(`\nDone → ${OUT_FILE}`);
