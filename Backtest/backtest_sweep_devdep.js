#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_sweep_devdep.js — ZigZag parameter sweep
// Same entry/exit logic as backtest_low_entry.js, varied over all
// (Dev%, Depth) combinations.
// Entry  : Next trading day after conf date — first hourly close ≤ confLow+0.3%
// SL     : Hourly CLOSE below conf date Low
// BE     : Daily CLOSE above conf date High → SL → cost
// 3R     : Hourly HIGH ≥ ep+3R → SL → ep+1.5R
// 5R     : Hourly HIGH ≥ ep+5R → SL → ep+3R
// Targets: r2 fixed | r3 trailing | r5 trailing
// Filter : cfCount ≥ 2
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_sweep_devdep.html';

// ── Sweep grid ────────────────────────────────────────────────────────
const DEV_VALUES = [3, 4, 5, 7, 10];
const DEP_VALUES = [5, 10, 15];

const GAPS             = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS   = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RISK_AMT         = 16000;

const NIFTY50_SYMS = [
  'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT','AXISBANK',
  'BAJAJ-AUTO','BAJAJFINSV','BAJFINANCE','BHARTIARTL','BPCL',
  'BRITANNIA','CIPLA','COALINDIA','DRREDDY','EICHERMOT',
  'GRASIM','HCLTECH','HDFCBANK','HDFCLIFE','HEROMOTOCO',
  'HINDALCO','HINDUNILVR','ICICIBANK','INDUSINDBK','INFY',
  'ITC','JSWSTEEL','KOTAKBANK','LT','M&M',
  'MARUTI','NESTLEIND','NTPC','ONGC','POWERGRID',
  'RELIANCE','SBIN','SHRIRAMFIN','SUNPHARMA','TATACONSUM',
  'TATAMOTORS','TATASTEEL','TCS','TECHM','TITAN',
  'TRENT','ULTRACEMCO','WIPRO','ZOMATO',
];
const MIDCAP_SYMS = [
  'ADANIPOWER','POONAWALLA','SUZLON','FEDERALBNK','PERSISTENT',
  'COFORGE','CANBK','SAIL','NMDC','RVNL','IRFC','MCX',
  'NATIONALUM','INDHOTEL','LTTS','MFSL','HUDCO','SRF',
  'POLYCAB','NHPC','SJVN','GMRINFRA','CONCOR',
  'COCHINSHIP','MAZDOCK',
];
const ALL_SYMS = [...NIFTY50_SYMS, ...MIDCAP_SYMS];

const SELECTED_SYMS = [
  'PERSISTENT','SHRIRAMFIN','HUDCO','SJVN','RVNL','COFORGE',
  'HINDALCO','ADANIPORTS','INDHOTEL','ICICIBANK','JSWSTEEL','TRENT','ASIANPAINT','LT','HCLTECH',
];

const HIST_NAMES = {
  BHARTIARTL:['BHARTI','BHARTIARTL'], HINDUNILVR:['HINDLEVER','HINDUNILVR'],
  INFY:['INFOSYSTCH','INFY'], JSWSTEEL:['JSWSTL','JSWSTEEL'],
  HINDALCO:['HINDALC0','HINDALCO'], TATASTEEL:['TISCO','TATASTEEL'],
  TATAMOTORS:['TELCO','TATAMOTORS'], AXISBANK:['UTIBANK','AXISBANK'],
  KOTAKBANK:['KOTAKMAH','KOTAKBANK'], HEROMOTOCO:['HEROHONDA','HEROMOTOCO'],
  BAJFINANCE:['BAJAUTOFIN','BAJFINANCE'],
};

// ── CSV helpers (matches original exactly) ────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const h = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const c = line.split(',');
    const o = {};
    h.forEach((k,i) => { o[k] = (c[i]||'').trim().replace(/^"|"$/g,''); });
    return o;
  });
}

function cleanOHLC(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const date  = (r.date||r.Date||'').trim();
    const open  = parseFloat(r.open||r.Open||0);
    const high  = parseFloat(r.high||r.High||0);
    const low   = parseFloat(r.low||r.Low||0);
    const close = parseFloat(r.close||r.Close||0);
    if (!date||high<=0||low<=0) continue;
    // Remove OHLC artifacts (>35% single-day move followed by reversal)
    if (i > 0 && i < rows.length-1) {
      const pc = out.length ? out[out.length-1].close : 0;
      const nc = parseFloat((rows[i+1]||{}).close||(rows[i+1]||{}).Close||0);
      if (pc > 0 && nc > 0) {
        const rb = close/pc, ra = nc/close;
        if ((rb>1.35&&ra<1/1.35)||(rb<1/1.35&&ra>1.35)) {
          const sf = pc/close;
          out.push({date,open:+(open*sf).toFixed(2),high:+(high*sf).toFixed(2),low:+(low*sf).toFixed(2),close:+(close*sf).toFixed(2)});
          continue;
        }
      }
    }
    out.push({date,open,high,low,close});
  }
  return out;
}

// ── Data loaders (exact match of original) ────────────────────────────
let _src1 = null;
function getSrc1() { if (!_src1) _src1 = parseCSV(fs.readFileSync(SRC1,'utf8')); return _src1; }

function loadAdjOHLC(sym) {
  const adjPath = path.join(ADJ_DIR, `${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r => parseInt(r.Volume||r.volume||0) > 0)
        .map(r => ({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
        .filter(r => r.date && r.high > 0)
        .sort((a,b) => a.date.localeCompare(b.date))
    );
  }
  const histNames = HIST_NAMES[sym]||[sym]; const symSet = new Set(histNames);
  const rows = getSrc1().filter(r => symSet.has(r.Symbol)).map(r => ({date:r.Date.trim(),open:parseFloat(r.Open||0),high:parseFloat(r.High||0),low:parseFloat(r.Low||0),close:parseFloat(r.Close||0)})).filter(r => r.date && r.high > 0);
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const existing = new Set(rows.map(r => r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8')).map(r => ({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)})).filter(r => r.date && r.high > 0 && !existing.has(r.date)).forEach(r => rows.push(r));
  }
  return cleanOHLC(rows.filter(r => r.date >= '2000-01-01').sort((a,b) => a.date.localeCompare(b.date)));
}

function loadRawOHLC(sym) {
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (!fs.existsSync(rawPath)) return [];
  return parseCSV(fs.readFileSync(rawPath,'utf8'))
    .map(r => ({date:(r.Date||r.date||'').trim(),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
    .filter(r => r.date && r.high > 0)
    .sort((a,b) => a.date.localeCompare(b.date));
}

const _idCache = {};
function loadIntradayByDate(sym) {
  if (_idCache[sym]) return _idCache[sym];
  const p = path.join(INTRADAY_DIR, `${sym}_60min.csv`);
  const byDate = {};
  if (!fs.existsSync(p)) { _idCache[sym] = byDate; return byDate; }
  const lines = fs.readFileSync(p,'utf8').trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const date = c[1]?.trim(), time = c[2]?.trim();
    if (!date || !time) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({time, open:parseFloat(c[3]), high:parseFloat(c[4]), low:parseFloat(c[5]), close:parseFloat(c[6])});
  }
  for (const d of Object.keys(byDate)) byDate[d].sort((a,b) => a.time.localeCompare(b.time));
  _idCache[sym] = byDate;
  return byDate;
}

// Cache adj/raw per symbol (shared across all dev/dep combos)
const _adjCache = {}, _rawCache = {};
function getAdj(sym) { if (!_adjCache[sym]) _adjCache[sym] = loadAdjOHLC(sym); return _adjCache[sym]; }
function getRaw(sym) { if (!_rawCache[sym]) _rawCache[sym] = loadRawOHLC(sym); return _rawCache[sym]; }

// ── ZigZag (parameterized — only change vs original) ──────────────────
function computeZigZag(rows, dev, dep) {
  const pivots=[]; if(!rows.length) return pivots;
  let trend=null,lhP=rows[0].high,lhD=rows[0].date,lhI=0,llP=rows[0].low,llD=rows[0].date,llI=0;
  for(let i=1;i<rows.length;i++){
    const{date,high,low}=rows[i];
    if(trend===null||trend==='UP'){
      if(high>=lhP){lhP=high;lhD=date;lhI=i;}
      if(lhP-low>=lhP*(dev/100)&&i-lhI>=dep){pivots.push({date:lhD,type:'H',price:lhP});trend='DOWN';llP=low;llD=date;llI=i;}
    }
    if(trend==='DOWN'){
      if(low<=llP){llP=low;llD=date;llI=i;}
      if(high-llP>=llP*(dev/100)&&i-llI>=dep){pivots.push({date:llD,type:'L',price:llP});trend='UP';lhP=high;lhD=date;lhI=i;}
    }
  }
  if(trend==='UP'&&lhI>0) pivots.push({date:lhD,type:'H',price:lhP});
  if(trend==='DOWN'&&llI>0) pivots.push({date:llD,type:'L',price:llP});
  return pivots;
}

function buildMatrix(pivots) {
  const m = {};
  pivots.forEach(p => {
    const d = new Date(p.date); const yr = d.getFullYear(), mi = d.getMonth(), day = String(d.getDate()).padStart(2,'0');
    if (!m[yr]) m[yr] = {}; if (!m[yr][mi]) m[yr][mi] = [];
    m[yr][mi].push({day, type:p.type});
  });
  return m;
}

function getConfluence(matrix, analysisYear, monthIdx) {
  const freq = {};
  GAPS.map(g => analysisYear-g).forEach(yr => {
    const yd = matrix[yr]; if (!yd||!yd[monthIdx]) return;
    yd[monthIdx].forEach(({day,type}) => { if (!freq[day]) freq[day]=[]; freq[day].push({year:yr,type}); });
  });
  const result = {};
  for (const [day,arr] of Object.entries(freq)) { if (arr.length >= 2) result[day] = arr; }
  return result;
}

// ── Trade simulation (exact copy from original) ───────────────────────
function simulateLowEntry(rawOhlcArr, rawDateIdx, rawDateMap, intradayByDate, refDate) {
  const refBar = rawDateMap[refDate];
  if (!refBar || refBar.high <= refBar.low || refBar.high <= 0) return null;

  const confLow   = refBar.low;
  const confHigh  = refBar.high;
  const entryZone = +(confLow * 1.003).toFixed(4);

  const refIdx = rawDateIdx[refDate];
  if (refIdx === undefined || refIdx >= rawOhlcArr.length - 1) return null;

  const entryDate    = rawOhlcArr[refIdx + 1].date;
  const entryCandles = intradayByDate[entryDate] || [];

  let ep = null, entryTime = null, trigIdx = -1;
  for (let ci = 0; ci < entryCandles.length; ci++) {
    const c = entryCandles[ci];
    if (c.close >= confLow && c.close <= entryZone) {
      ep = c.close; entryTime = c.time; trigIdx = ci; break;
    }
  }
  if (!ep) return null;

  const risk = ep - confLow;
  if (risk <= 0) return null;

  const results = {};

  for (const targetR of [2, 3, 5]) {
    const isFixed  = targetR === 2;
    const fixedTgt = ep + 2 * risk;

    let currentSL  = confLow;
    let trailLevel = 0;
    let outcome    = 'open';
    let exitDate   = '', exitTime = '', exitPrice = 0, barsHeld = 0;
    let maxFav     = 0;
    let done       = false;

    function slLabel() {
      if (trailLevel === 0) return 'SL';
      if (trailLevel === 1) return 'BE';
      return 'TRAIL';
    }
    function tryBE() { if (trailLevel < 1) { trailLevel = 1; currentSL = ep; } }
    function try3R(candleHigh) {
      if (candleHigh >= ep + 3 * risk && trailLevel < 2) { trailLevel = 2; currentSL = ep + 1.5 * risk; }
    }
    function try5R(candleHigh) {
      if (targetR === 5 && candleHigh >= ep + 5 * risk && trailLevel < 3) { trailLevel = 3; currentSL = ep + 3 * risk; }
    }
    function tickCandle(c, date) {
      if (done) return;
      const fav = c.high - ep;
      if (fav > maxFav) maxFav = fav;
      try3R(c.high); try5R(c.high);
      if (c.close < currentSL) {
        outcome = slLabel(); exitPrice = currentSL; exitDate = date; exitTime = c.time; done = true; return;
      }
      if (isFixed && c.close >= fixedTgt) {
        outcome = 'TARGET'; exitPrice = fixedTgt; exitDate = date; exitTime = c.time; done = true;
      }
    }

    let dayClose = 0;
    for (let ci = trigIdx; ci < entryCandles.length && !done; ci++) {
      tickCandle(entryCandles[ci], entryDate);
      dayClose = entryCandles[ci].close;
    }
    if (!done) { if (dayClose > confHigh) tryBE(); barsHeld = 1; }

    for (let di = refIdx + 2; di < rawOhlcArr.length && !done; di++) {
      const dayRow  = rawOhlcArr[di];
      const date    = dayRow.date;
      const candles = intradayByDate[date] || [];
      barsHeld++;
      dayClose = 0;

      if (candles.length) {
        for (const c of candles) { if (!done) { tickCandle(c, date); dayClose = c.close; } }
      } else {
        const fav = dayRow.high - ep;
        if (fav > maxFav) maxFav = fav;
        try3R(dayRow.high); try5R(dayRow.high);
        if (dayRow.close < currentSL) {
          outcome = slLabel(); exitPrice = currentSL; exitDate = date; exitTime = 'EOD'; done = true;
        }
        if (!done && isFixed && dayRow.high >= fixedTgt) {
          outcome = 'TARGET'; exitPrice = fixedTgt; exitDate = date; exitTime = 'EOD'; done = true;
        }
        dayClose = dayRow.close;
      }

      if (!done && dayClose > confHigh) tryBE();
      if (!done && barsHeld > 250) {
        outcome = 'open'; exitDate = date; exitPrice = dayRow.close; done = true;
      }
    }

    if (!done) {
      const last = rawOhlcArr[rawOhlcArr.length - 1];
      exitDate = last.date; exitPrice = last.close || ep; outcome = 'open';
    }

    const rMult = (exitPrice - ep) / risk;
    results[`r${targetR}`] = {
      outcome, exitDate, exitTime,
      exitPrice: +exitPrice.toFixed(2),
      rMult: +rMult.toFixed(2),
    };
  }

  return { ep:+ep.toFixed(2), risk:+risk.toFixed(2), confLow:+confLow.toFixed(2),
           confHigh:+confHigh.toFixed(2), entryDate, entryTime, ...results };
}

// ── Backtest one symbol with given dev/dep ────────────────────────────
const today = new Date().toISOString().slice(0,10);

function backtestSym(sym, dev, dep) {
  const adjOHLC = getAdj(sym);
  const rawOHLC = getRaw(sym);
  if (!adjOHLC.length || !rawOHLC.length) return [];

  const rawDateMap = {}; rawOHLC.forEach(r => rawDateMap[r.date] = r);
  const rawDateIdx = {}; rawOHLC.forEach((r,i) => rawDateIdx[r.date] = i);
  const intradayByDate = loadIntradayByDate(sym);

  const pivots = computeZigZag(adjOHLC, dev, dep);
  const matrix = buildMatrix(pivots);
  const trades = [];

  for (const yr of ANALYSIS_YEARS) {
    for (let mi = 0; mi < 12; mi++) {
      const conf = getConfluence(matrix, yr, mi);
      for (const [day, arr] of Object.entries(conf)) {
        if (parseInt(day) > new Date(yr, mi+1, 0).getDate()) continue;
        const cfCount = arr.length;
        const h = arr.some(e => e.type==='H'), l = arr.some(e => e.type==='L');
        const cfType = (h&&l)?'HL':h?'H':'L';
        const refDate = `${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
        const live    = refDate >= today ? 'Y' : 'N';
        const res = simulateLowEntry(rawOHLC, rawDateIdx, rawDateMap, intradayByDate, refDate);
        if (!res) continue;
        trades.push({ sym, analysisYear:yr, month:MONTH_NAMES[mi], confDate:refDate,
                      cfType, cfCount, live, dev, dep, ...res });
      }
    }
  }
  return trades;
}

// ── Stats ─────────────────────────────────────────────────────────────
function calcStats(trades, rKey) {
  const closed = trades.filter(t => t[rKey]?.outcome !== 'open');
  if (!closed.length) return { n:0, open:0, wins:0, bes:0, sls:0, wr:0, ev:0 };
  const wins = closed.filter(t => t[rKey].outcome==='TARGET').length;
  const bes  = closed.filter(t => t[rKey].outcome==='BE').length;
  const sls  = closed.filter(t => t[rKey].outcome==='SL').length;
  const evs  = closed.reduce((s,t) => s+(t[rKey].rMult??0), 0) / closed.length;
  return { n:closed.length, open:trades.length-closed.length, wins, bes, sls, wr:wins/closed.length, ev:evs };
}

function calmar(trades, rKey) {
  const closed = [...trades.filter(t => t[rKey]?.outcome!=='open')]
    .sort((a,b) => a.entryDate.localeCompare(b.entryDate));
  if (closed.length < 3) return null;
  let peak=0, maxDD=0, cap=0;
  for (const t of closed) {
    cap += (t[rKey].rMult ?? 0);
    if (cap > peak) peak = cap;
    const dd = peak - cap;
    if (dd > maxDD) maxDD = dd;
  }
  if (maxDD === 0) return null;
  return +(cap / maxDD).toFixed(2);
}

function durationStats(trades, rKey) {
  const closed = trades.filter(t => t[rKey]?.outcome!=='open' && t[rKey]?.exitDate);
  if (!closed.length) return { avgDays: '—' };
  let totalDays = 0;
  for (const t of closed) {
    const ms = new Date(t[rKey].exitDate) - new Date(t.entryDate);
    totalDays += ms / 86400000;
  }
  return { avgDays: (totalDays/closed.length).toFixed(1) };
}

// ── HTML helpers ──────────────────────────────────────────────────────
function cls(v) { return v > 0.15 ? 'pos' : v < -0.05 ? 'neg' : 'neu'; }

function symTable(trades) {
  if (!trades.length) return '<p style="color:#888;padding:12px">No trades.</p>';
  const map = {};
  trades.forEach(t => { if (!map[t.sym]) map[t.sym]=[]; map[t.sym].push(t); });
  const rows = Object.entries(map).map(([sym,ts]) => {
    const s2=calcStats(ts,'r2'), s3=calcStats(ts,'r3'), s5=calcStats(ts,'r5');
    const cal = calmar(ts,'r2');
    const calStr = cal==null?'—':cal.toFixed(2);
    const calCls = cal==null?'neu':cal>=1?'pos':cal>=0?'neu':'neg';
    return { sym, n:s2.n, cal:(cal??-99), calStr, calCls,
             wr2:s2.wr, ev2:s2.ev, wr3:s3.wr, ev3:s3.ev, wr5:s5.wr, ev5:s5.ev };
  }).sort((a,b) => b.cal-a.cal);

  return `<div style="overflow-x:auto">
<table class="sym-table">
<thead><tr>
  <th>Symbol</th><th>N</th>
  <th class="c2r">WR 2R</th><th class="c2r">EV 2R</th><th class="c2r">Calmar</th>
  <th class="c3r">WR 3R</th><th class="c3r">EV 3R</th>
  <th class="c5r">WR 5R</th><th class="c5r">EV 5R</th>
</tr></thead><tbody>
${rows.map(r=>`<tr>
  <td class="sym">${r.sym}</td><td>${r.n}</td>
  <td class="${cls(r.wr2-.5)}">${(r.wr2*100).toFixed(0)}%</td>
  <td class="${cls(r.ev2)}">${r.ev2.toFixed(2)}R</td>
  <td class="${r.calCls}"><b>${r.calStr}</b></td>
  <td class="${cls(r.wr3-.4)}">${(r.wr3*100).toFixed(0)}%</td>
  <td class="${cls(r.ev3)}">${r.ev3.toFixed(2)}R</td>
  <td class="${cls(r.wr5-.4)}">${(r.wr5*100).toFixed(0)}%</td>
  <td class="${cls(r.ev5)}">${r.ev5.toFixed(2)}R</td>
</tr>`).join('')}
</tbody></table></div>`;
}

// ── Main sweep ────────────────────────────────────────────────────────
const combos = [];
for (const dev of DEV_VALUES) for (const dep of DEP_VALUES) combos.push({dev,dep});

const comboLabel = ({dev,dep}) => `Dev ${dev}% / Dep ${dep}`;
const comboId    = ({dev,dep}) => `c${dev}_${dep}`;

const results = [];

console.log(`\nGann Confluence — ZigZag Dev/Depth Sweep`);
console.log(`${combos.length} combinations × ${ALL_SYMS.length} symbols\n`);

// Preload adj/raw/intraday for all symbols (one-time cost)
process.stdout.write('Preloading OHLC data … ');
for (const sym of ALL_SYMS) { try { getAdj(sym); getRaw(sym); loadIntradayByDate(sym); } catch {} }
console.log('done');

for (const {dev,dep} of combos) {
  process.stdout.write(`  Dev=${dev}%  Dep=${dep}  … `);
  const t0 = Date.now();
  const allTrades = [];

  for (const sym of ALL_SYMS) {
    try { allTrades.push(...backtestSym(sym, dev, dep)); } catch {}
  }

  const hist    = allTrades.filter(t => t.live==='N');
  const selHist = hist.filter(t => SELECTED_SYMS.includes(t.sym));

  const s2a=calcStats(hist,'r2'), s3a=calcStats(hist,'r3'), s5a=calcStats(hist,'r5');
  const s2s=calcStats(selHist,'r2'), s3s=calcStats(selHist,'r3'), s5s=calcStats(selHist,'r5');
  const cal2a = calmar(hist,'r2'), cal2s = calmar(selHist,'r2');
  const dur2a  = durationStats(hist,'r2');

  results.push({ dev, dep, hist, selHist,
    s2a,s3a,s5a, cal2a, dur2a,
    s2s,s3s,s5s, cal2s });

  console.log(`${((Date.now()-t0)/1000).toFixed(1)}s  N=${s2a.n}  EV2R=${s2a.ev.toFixed(2)}  EV5R=${s5a.ev.toFixed(2)}  CAL=${cal2a??'—'}`);
}

console.log('\nBuilding HTML …');

// ── Comparison table ──────────────────────────────────────────────────
function compTable(res, key) {
  const sa = r => key==='all' ? r.s2a : r.s2s;
  const sb = r => key==='all' ? r.s3a : r.s3s;
  const sc = r => key==='all' ? r.s5a : r.s5s;
  const cal= r => key==='all' ? r.cal2a : r.cal2s;

  const best = {
    ev2: Math.max(...res.map(r => sa(r).ev||0)),
    ev3: Math.max(...res.map(r => sb(r).ev||0)),
    ev5: Math.max(...res.map(r => sc(r).ev||0)),
    cal: Math.max(...res.map(r => cal(r)??-99)),
    n:   Math.max(...res.map(r => sa(r).n||0)),
  };

  const rows = res.map(r => {
    const s2=sa(r), s3=sb(r), s5=sc(r), c=cal(r), d=r.dur2a;
    const calStr = c==null?'—':c.toFixed(2);
    const calCls = c==null?'neu':c>=1?'pos':c>=0?'neu':'neg';
    const hi = (val,bst) => Math.abs((val??-99)-bst)<0.0001?' best-cell':'';
    const isBestCal = c!=null && Math.abs(c-(best.cal??-99))<0.001;
    return `<tr>
  <td><b>${r.dev}%</b></td><td>${r.dep}</td>
  <td${hi(s2.n,best.n)}>${s2.n}</td>
  <td class="${cls(s2.wr-.5)}">${(s2.wr*100).toFixed(0)}%</td>
  <td class="${cls(s2.ev)}${hi(s2.ev,best.ev2)}">${s2.ev.toFixed(2)}R</td>
  <td class="${calCls}${isBestCal?' best-cell':''}"><b>${calStr}</b></td>
  <td class="${cls(s3.wr-.4)}">${(s3.wr*100).toFixed(0)}%</td>
  <td class="${cls(s3.ev)}${hi(s3.ev,best.ev3)}">${s3.ev.toFixed(2)}R</td>
  <td class="${cls(s5.wr-.4)}">${(s5.wr*100).toFixed(0)}%</td>
  <td class="${cls(s5.ev)}${hi(s5.ev,best.ev5)}">${s5.ev.toFixed(2)}R</td>
  <td>${d.avgDays}</td>
</tr>`;
  });

  return `<table class="comp-table">
<thead><tr>
  <th>Dev%</th><th>Depth</th><th>N trades</th>
  <th class="c2r">WR 2R</th><th class="c2r">EV 2R</th><th class="c2r">Calmar 2R</th>
  <th class="c3r">WR 3R</th><th class="c3r">EV 3R</th>
  <th class="c5r">WR 5R</th><th class="c5r">EV 5R</th>
  <th>Avg days</th>
</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

// ── Per-combo detail ──────────────────────────────────────────────────
const detailSections = results.map(r => `
<div class="combo-section" id="${comboId(r)}">
  <div class="combo-header">Dev ${r.dev}% / Depth ${r.dep} bars</div>
  <div class="two-col">
    <div>
      <div class="col-label">All 74 Symbols — sorted by Calmar 2R</div>
      ${symTable(r.hist)}
    </div>
    <div>
      <div class="col-label">15 Selected Names — sorted by Calmar 2R</div>
      ${symTable(r.selHist)}
    </div>
  </div>
</div>`).join('\n');

// ── Full HTML ─────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann — ZigZag Dev/Depth Sweep</title>
<style>
  :root{
    --bg:#0d1117;--panel:#161b22;--panel2:#1c2128;
    --border:#30363d;--text:#e6edf3;--sub:#8b949e;
    --accent:#58a6ff;--pos:#3fb950;--neg:#f85149;--neu:#8b949e;--gold:#ffe066;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;}
  a{color:var(--accent);text-decoration:none;}

  .page-header{background:var(--panel);border-bottom:1px solid var(--border);padding:16px 28px;position:sticky;top:0;z-index:100;}
  .page-header h1{font-size:18px;font-weight:700;margin-bottom:4px;}
  .page-header p{color:var(--sub);font-size:11.5px;}

  .tab-nav{display:flex;gap:2px;background:var(--panel2);padding:8px 28px;border-bottom:1px solid var(--border);}
  .tab-btn{background:none;border:none;color:var(--sub);padding:7px 18px;cursor:pointer;border-radius:6px;font-size:12px;font-weight:600;transition:all .15s;}
  .tab-btn:hover{color:var(--text);background:rgba(255,255,255,.06);}
  .tab-btn.active{color:var(--accent);background:rgba(88,166,255,.12);}
  .tab-content{display:none;padding:24px 28px;}
  .tab-content.active{display:block;}

  h2{font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text);}

  /* comparison table */
  .comp-table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:8px;}
  .comp-table th,.comp-table td{border:1px solid var(--border);padding:6px 10px;text-align:right;}
  .comp-table th{background:var(--panel2);color:var(--sub);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;text-align:center;position:sticky;top:0;}
  .comp-table td:first-child,.comp-table td:nth-child(2){text-align:center;}
  .comp-table tr:hover td{background:rgba(88,166,255,.06);}
  .best-cell{box-shadow:inset 0 0 0 2px var(--gold);font-weight:700;}
  th.c2r,td.c2r{border-left:3px solid #1a3a5c;}
  th.c3r,td.c3r{border-left:3px solid #1a3a2a;}
  th.c5r,td.c5r{border-left:3px solid #3a1a3a;}

  /* sym table */
  .sym-table{border-collapse:collapse;width:100%;font-size:11px;}
  .sym-table th,.sym-table td{border:1px solid var(--border);padding:4px 8px;text-align:right;}
  .sym-table th{background:var(--panel2);color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.3px;}
  .sym-table td:first-child{text-align:left;}
  .sym-table td.sym{color:var(--accent);font-weight:700;font-size:12px;}
  .sym-table tr:hover td{background:rgba(88,166,255,.05);}
  .sym-table th.c2r,.sym-table td.c2r{border-left:2px solid #1a3a5c;}
  .sym-table th.c3r,.sym-table td.c3r{border-left:2px solid #1a3a2a;}
  .sym-table th.c5r,.sym-table td.c5r{border-left:2px solid #3a1a3a;}

  .pos{color:var(--pos);}.neg{color:var(--neg);}.neu{color:var(--sub);}

  /* detail sections */
  .combo-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;}
  .pill{background:var(--panel2);border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:11px;color:var(--sub);cursor:pointer;transition:all .15s;}
  .pill:hover{border-color:var(--accent);color:var(--accent);}
  .combo-section{margin-bottom:52px;scroll-margin-top:80px;}
  .combo-header{font-size:16px;font-weight:700;color:var(--gold);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:16px;}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;}
  @media(max-width:1100px){.two-col{grid-template-columns:1fr;}}
  .col-label{font-size:11px;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}

  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:var(--bg);}
  ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px;}
</style>
</head>
<body>

<div class="page-header">
  <h1>Gann Confluence — ZigZag Dev% / Depth Parameter Sweep</h1>
  <p>Entry: first hourly close ≤ confLow+0.3% &nbsp;·&nbsp; SL: hourly close &lt; confLow
     &nbsp;·&nbsp; BE → 3R → 5R ratchets &nbsp;·&nbsp; cfCount ≥ 2
     &nbsp;·&nbsp; ${combos.length} combinations × ${ALL_SYMS.length} symbols</p>
</div>

<div class="tab-nav">
  <button class="tab-btn active" onclick="switchTab('cmp-all',this)">📊 All 74 — Comparison</button>
  <button class="tab-btn" onclick="switchTab('cmp-sel',this)">⭐ 15 Selected — Comparison</button>
  <button class="tab-btn" onclick="switchTab('detail',this)">🔬 Per-Combo Detail</button>
</div>

<div id="tab-cmp-all" class="tab-content active">
  <h2>All 74 Symbols — Metrics across all ZigZag parameters (★ = column best)</h2>
  ${compTable(results,'all')}
  <p style="color:var(--sub);font-size:11px;margin-top:8px">Gold outline = best value in that column.</p>
</div>

<div id="tab-cmp-sel" class="tab-content">
  <h2>15 Selected Names — Metrics across all ZigZag parameters</h2>
  <p style="color:var(--sub);font-size:12px;margin-bottom:14px">${SELECTED_SYMS.join(', ')}</p>
  ${compTable(results,'sel')}
</div>

<div id="tab-detail" class="tab-content">
  <div class="combo-pills">
    ${results.map(r=>`<span class="pill" onclick="jump('${comboId(r)}')">${comboLabel(r)}</span>`).join('')}
  </div>
  ${detailSections}
</div>

<script>
function switchTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
function jump(id){
  const el=document.getElementById(id);
  if(el){el.scrollIntoView({behavior:'smooth',block:'start'});}
}
</script>
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`✓ HTML → ${OUT_HTML}\n`);
