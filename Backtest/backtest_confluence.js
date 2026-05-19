#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_confluence.js — Gann Confluence Backtest
// ─────────────────────────────────────────────────────────────────────
// Strategy:
//   Signal  : Gann confluence date (same day in ≥2 of 11 lookback years)
//   Ref bar : confluence date (or next trading day if market holiday)
//   LONG    : first hourly CLOSE on entry day > ref High → enter at ref High
//   SHORT   : first hourly CLOSE on entry day < ref Low  → enter at ref Low
//   SL LONG : ref Low  |  SL SHORT: ref High
//   Exit    : SL hit (hourly), or 20 trading-day time exit (daily close)
//
// Entry uses actual 60-min Kite data from processed_intraday/SYMBOL_60min.csv
// Exit uses daily data for efficiency (SL checked on hourly candles of entry day,
// then daily Low/High for subsequent days).
//
// Usage:
//   node backtest_confluence.js              — all 74 symbols
//   node backtest_confluence.js NATIONALUM   — single symbol, verbose
//   node backtest_confluence.js --dir LONG   — filter to LONG trades only
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────
const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_CSV      = 'j:/GANN Claude/backtest_results.csv';
const OUT_HTML     = 'j:/GANN Claude/backtest_results.html';

const DEV  = 4;
const DEP  = 10;
const GAPS = [20,15,13,12,10,6,5,4,3,2,1]; // Gann lookback gaps
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MAX_BARS = 20; // time exit if SL not hit

// ── Instruments ────────────────────────────────────────────────────────
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

const HIST_NAMES = {
  BHARTIARTL: ['BHARTI','BHARTIARTL'],
  HINDUNILVR: ['HINDLEVER','HINDUNILVR'],
  INFY:       ['INFOSYSTCH','INFY'],
  JSWSTEEL:   ['JSWSTL','JSWSTEEL'],
  HINDALCO:   ['HINDALC0','HINDALCO'],
  TATASTEEL:  ['TISCO','TATASTEEL'],
  TATAMOTORS: ['TELCO','TATAMOTORS'],
  AXISBANK:   ['UTIBANK','AXISBANK'],
  KOTAKBANK:  ['KOTAKMAH','KOTAKBANK'],
  HEROMOTOCO: ['HEROHONDA','HEROMOTOCO'],
  BAJFINANCE: ['BAJAUTOFIN','BAJFINANCE'],
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── CSV / OHLC helpers ────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h,i) => { obj[h] = (cols[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  });
}

function cleanOHLC(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    let { date, open, high, low, close } = rows[i];
    if (high > close * 2.0) high = +(close * 1.05).toFixed(2);
    if (close > low  * 2.0) low  = +(close * 0.95).toFixed(2);
    if (open > close * 2.0) open = +(close * 1.02).toFixed(2);
    if (close > open * 2.0) open = +(close * 0.98).toFixed(2);
    if (i > 0 && i < rows.length - 1) {
      const pc = out[out.length - 1].close;
      const nc = rows[i + 1].close;
      const rb = close / pc, ra = nc / close;
      if ((rb > 1.35 && ra < 1/1.35) || (rb < 1/1.35 && ra > 1.35)) {
        const sf = pc / close;
        out.push({ date, open:+(open*sf).toFixed(2), high:+(high*sf).toFixed(2),
                   low:+(low*sf).toFixed(2), close:+(close*sf).toFixed(2) });
        continue;
      }
    }
    out.push({ date, open, high, low, close });
  }
  return out;
}

let _src1 = null;
function getSrc1() {
  if (!_src1) _src1 = parseCSV(fs.readFileSync(SRC1,'utf8'));
  return _src1;
}

function mergeRows(sym) {
  const adjPath = path.join(ADJ_DIR, `${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r => parseInt(r.Volume||r.volume||0) > 0)
        .map(r => ({
          date:  (r.Date||r.date||'').trim(),
          open:  parseFloat(r.Open||r.open||0),
          high:  parseFloat(r.High||r.high||0),
          low:   parseFloat(r.Low||r.low||0),
          close: parseFloat(r.Close||r.close||0),
        }))
        .filter(r => r.date && r.high > 0)
        .sort((a,b) => a.date.localeCompare(b.date))
    );
  }
  // Fallback for symbols with no Yahoo Finance adjusted data
  const histNames = HIST_NAMES[sym] || [sym];
  const symSet = new Set(histNames);
  const rows = getSrc1()
    .filter(r => symSet.has(r.Symbol))
    .map(r => ({ date:r.Date.trim(), open:parseFloat(r.Open||0),
                 high:parseFloat(r.High||0), low:parseFloat(r.Low||0), close:parseFloat(r.Close||0) }))
    .filter(r => r.date && r.high > 0);
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const existing = new Set(rows.map(r => r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8'))
      .map(r => ({ date:(r.Date||r.date||'').trim(), open:parseFloat(r.Open||r.open||0),
                   high:parseFloat(r.High||r.high||0), low:parseFloat(r.Low||r.low||0),
                   close:parseFloat(r.Close||r.close||0) }))
      .filter(r => r.date && r.high > 0 && !existing.has(r.date))
      .forEach(r => rows.push(r));
  }
  return cleanOHLC(rows.filter(r => r.date >= '2000-01-01').sort((a,b) => a.date.localeCompare(b.date)));
}

// ── ZigZag ────────────────────────────────────────────────────────────
function computeZigZag(rows, dev, dep) {
  const pivots = [];
  if (!rows || !rows.length) return pivots;
  // rows: [{date, open, high, low, close}]
  let trend=null,
      lhP=rows[0].high, lhD=rows[0].date, lhI=0,
      llP=rows[0].low,  llD=rows[0].date, llI=0;
  for (let i=1; i<rows.length; i++) {
    const { date, high, low } = rows[i];
    if (trend===null || trend==='UP') {
      if (high>=lhP) { lhP=high; lhD=date; lhI=i; }
      if (low<=lhP*(1-dev/100) && (i-lhI)>=dep) {
        pivots.push({ date:lhD, type:'H', price:lhP });
        trend='DOWN';
        llP=low; llD=date; llI=i;
        for (let j=lhI+1; j<=i; j++) {
          if (rows[j].low<llP) { llP=rows[j].low; llD=rows[j].date; llI=j; }
        }
      }
    }
    if (trend==='DOWN') {
      if (low<=llP) { llP=low; llD=date; llI=i; }
      if (high>=llP*(1+dev/100) && (i-llI)>=dep) {
        pivots.push({ date:llD, type:'L', price:llP });
        trend='UP';
        lhP=high; lhD=date; lhI=i;
        for (let j=llI+1; j<=i; j++) {
          if (rows[j].high>lhP) { lhP=rows[j].high; lhD=rows[j].date; lhI=j; }
        }
      }
    }
  }
  if (trend==='UP')   pivots.push({ date:lhD, type:'H', price:lhP });
  else if (trend==='DOWN') pivots.push({ date:llD, type:'L', price:llP });
  return pivots;
}

function buildMatrix(pivots) {
  const m = {};
  pivots.forEach(({ date, type, price }) => {
    const yr = +date.substring(0,4);
    const mi = +date.substring(5,7)-1;
    const dd = date.substring(8,10);
    if (!m[yr]) m[yr] = Array.from({length:12},()=>[]);
    m[yr][mi].push({ day:dd, type, price });
  });
  return m;
}

// ── Confluence ────────────────────────────────────────────────────────
function getConfluence(matrix, analysisYear, monthIdx) {
  const freq = {};
  GAPS.map(g => analysisYear - g).forEach(yr => {
    const yd = matrix[yr];
    if (!yd || !yd[monthIdx]) return;
    yd[monthIdx].forEach(({ day, type }) => {
      if (!freq[day]) freq[day] = [];
      freq[day].push({ year:yr, type });
    });
  });
  const result = {};
  for (const [day, arr] of Object.entries(freq)) {
    if (arr.length >= 2) result[day] = arr;
  }
  return result;
}

// ── Intraday data loader ──────────────────────────────────────────────
// Returns Map<date-string, [{time, open, high, low, close}]> sorted by time
// Prices are raw/unadjusted (Kite API prices = actual market prices)
const _intradayCache = {};
function loadIntradayByDate(sym) {
  if (_intradayCache[sym]) return _intradayCache[sym];
  const p = path.join(INTRADAY_DIR, `${sym}_60min.csv`);
  const byDate = {};
  if (!fs.existsSync(p)) { _intradayCache[sym] = byDate; return byDate; }
  const lines = fs.readFileSync(p,'utf8').trim().split('\n');
  for (let i=1; i<lines.length; i++) {
    const cols = lines[i].split(',');
    const date = cols[1]?.trim();
    const time = cols[2]?.trim();
    if (!date || !time) continue;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({
      time,
      open:  parseFloat(cols[3]),
      high:  parseFloat(cols[4]),
      low:   parseFloat(cols[5]),
      close: parseFloat(cols[6]),
    });
  }
  for (const d of Object.keys(byDate)) byDate[d].sort((a,b) => a.time.localeCompare(b.time));
  _intradayCache[sym] = byDate;
  return byDate;
}

// ── Raw daily price loader ────────────────────────────────────────────
// Returns Map<date, {high, low, close}> using bhavcopy (unadjusted) prices.
// Kite intraday prices are also unadjusted, so we compare like-for-like.
// Adjusted (Yahoo) prices are only used for ZigZag/confluence computation.
const _rawCache = {};
function loadRawDateMap(sym) {
  if (_rawCache[sym]) return _rawCache[sym];
  const map = {};
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const lines = fs.readFileSync(rawPath,'utf8').trim().split('\n');
    const h = lines[0].split(',').map(x=>x.trim().replace(/^"|"$/g,''));
    const iDate  = h.findIndex(x => /^date$/i.test(x));
    const iHigh  = h.findIndex(x => /^high$/i.test(x));
    const iLow   = h.findIndex(x => /^low$/i.test(x));
    const iClose = h.findIndex(x => /^close$/i.test(x));
    for (let i=1; i<lines.length; i++) {
      const c = lines[i].split(',');
      const date = c[iDate]?.trim();
      if (!date) continue;
      map[date] = {
        high:  parseFloat(c[iHigh]  || 0),
        low:   parseFloat(c[iLow]   || 0),
        close: parseFloat(c[iClose] || 0),
      };
    }
  }
  _rawCache[sym] = map;
  return map;
}

// ── Trade simulation ──────────────────────────────────────────────────
// Uses raw (bhavcopy) prices for entry/SL/exit so they match Kite intraday.
// intradayByDate: Map<date, [{time,open,high,low,close}]> — Kite 60-min
// rawDateMap: Map<date, {high,low,close}> — bhavcopy raw daily prices
function simulateTrade(ohlc, refIdx, dir, intradayByDate, rawDateMap) {
  const refBar   = ohlc[refIdx];
  const entryIdx = refIdx + 1;
  if (entryIdx >= ohlc.length) return null;
  const entryBar = ohlc[entryIdx];

  // ── Entry/SL levels: use raw bhavcopy price for ref bar ──────────
  // Raw and adjusted prices match on current dates; differ only for pre-bonus/split dates.
  const rawRef = rawDateMap?.[refBar.date];
  const refH = rawRef?.high  ?? refBar.high;
  const refL = rawRef?.low   ?? refBar.low;
  const ep   = dir==='LONG' ? refH : refL;
  const sl   = dir==='LONG' ? refL : refH;
  const risk = dir==='LONG' ? ep-sl : sl-ep;
  if (risk <= 0) return null;

  // ── Entry trigger using hourly CLOSE ─────────────────────────────
  let entryTime = null;
  const hourlyCandlesEntry = intradayByDate?.[entryBar.date] || [];

  if (hourlyCandlesEntry.length) {
    for (const c of hourlyCandlesEntry) {
      if (dir==='LONG'  && c.close > ep) { entryTime=c.time; break; }
      if (dir==='SHORT' && c.close < ep) { entryTime=c.time; break; }
    }
    if (!entryTime) return null; // no hourly close crossed → trade not triggered
  } else {
    // Fallback: daily raw approximation
    const rawEntry = rawDateMap?.[entryBar.date];
    const eH = rawEntry?.high ?? entryBar.high;
    const eL = rawEntry?.low  ?? entryBar.low;
    if (dir==='LONG'  && eH <= ep) return null;
    if (dir==='SHORT' && eL >= ep) return null;
  }

  // ── Exit tracking ─────────────────────────────────────────────────
  let maxFav=0, outcome='timeout', exitPrice=0, exitDate='', barsHeld=0;
  let slHitOnEntryDay = false;

  // Check SL on entry day hourly candles from trigger candle onward
  if (hourlyCandlesEntry.length && entryTime) {
    let triggered = false;
    for (const c of hourlyCandlesEntry) {
      if (!triggered) {
        if (dir==='LONG'  && c.close > ep) triggered = true;
        if (dir==='SHORT' && c.close < ep) triggered = true;
        if (!triggered) continue;
      }
      const fav = dir==='LONG' ? c.high-ep : ep-c.low;
      if (fav > maxFav) maxFav = fav;
      if (dir==='LONG'  && c.low  <= sl) { outcome='SL'; exitPrice=sl; exitDate=entryBar.date; slHitOnEntryDay=true; break; }
      if (dir==='SHORT' && c.high >= sl) { outcome='SL'; exitPrice=sl; exitDate=entryBar.date; slHitOnEntryDay=true; break; }
    }
  }

  // Track subsequent daily bars using raw prices
  if (!slHitOnEntryDay) {
    for (let j=entryIdx; j<Math.min(entryIdx+MAX_BARS, ohlc.length); j++) {
      barsHeld++;
      const b    = ohlc[j];
      const rawB = rawDateMap?.[b.date];
      const bH   = rawB?.high  ?? b.high;
      const bL   = rawB?.low   ?? b.low;
      const fav  = dir==='LONG' ? bH-ep : ep-bL;
      if (fav > maxFav) maxFav = fav;
      if (dir==='LONG'  && bL <= sl) { outcome='SL'; exitPrice=sl; exitDate=b.date; break; }
      if (dir==='SHORT' && bH >= sl) { outcome='SL'; exitPrice=sl; exitDate=b.date; break; }
    }
  } else {
    barsHeld = 1;
  }

  if (outcome !== 'SL') {
    const lastBar = ohlc[Math.min(entryIdx+MAX_BARS-1, ohlc.length-1)];
    const rawLast = rawDateMap?.[lastBar.date];
    exitPrice = rawLast?.close ?? lastBar.close;
    exitDate  = lastBar.date;
  }

  const pnl    = dir==='LONG' ? exitPrice-ep : ep-exitPrice;
  const pnlPct = (pnl / ep * 100);
  const rMult  = pnl / risk;

  return {
    dir,
    refDate:   refBar.date,
    refHigh:   +refH.toFixed(2),
    refLow:    +refL.toFixed(2),
    entryDate: entryBar.date,
    entryTime: entryTime || 'daily',
    ep:        +ep.toFixed(2),
    sl:        +sl.toFixed(2),
    risk:      +risk.toFixed(2),
    maxFavPct: +(maxFav/ep*100).toFixed(2),
    exitDate,
    exitPrice: +exitPrice.toFixed(2),
    outcome,
    barsHeld,
    pnlPct:    +pnlPct.toFixed(2),
    rMult:     +rMult.toFixed(2),
  };
}

// ── Backtest one symbol ────────────────────────────────────────────────
function backtestSym(sym, verbose=false) {
  const ohlc = mergeRows(sym);
  if (ohlc.length < 50) return [];

  const dateIdx = {};
  ohlc.forEach((r,i) => { dateIdx[r.date] = i; });
  const tradingDates = ohlc.map(r => r.date);
  const lastDate = tradingDates[tradingDates.length-1];

  // Raw (bhavcopy) prices for entry/SL/exit — matches Kite intraday (both unadjusted)
  const rawDateMap = loadRawDateMap(sym);
  // 60-min Kite intraday data for exact hourly entry trigger
  const intradayByDate = loadIntradayByDate(sym);
  const hasIntraday = Object.keys(intradayByDate).length > 0;
  if (verbose) console.log(`  Intraday: ${hasIntraday ? Object.keys(intradayByDate).length + ' dates' : 'not available (daily fallback)'}`);

  const pivots = computeZigZag(ohlc, DEV, DEP);
  const matrix = buildMatrix(pivots);

  const trades = [];

  for (const analysisYear of ANALYSIS_YEARS) {
    for (let mi=0; mi<12; mi++) {
      const conf = getConfluence(matrix, analysisYear, mi);

      for (const [day, arr] of Object.entries(conf)) {
        const mm      = String(mi+1).padStart(2,'0');
        const ddInt   = parseInt(day);
        // Skip if day is invalid for this month (e.g. day 31 in a 30-day month)
        const daysInMon = new Date(analysisYear, mi+1, 0).getDate();
        if (ddInt > daysInMon) continue;

        const confDate = `${analysisYear}-${mm}-${day}`;

        // Reference bar: confDate if it's a trading day, else next trading day
        let refIdx = dateIdx[confDate];
        if (refIdx === undefined) {
          const nd = tradingDates.find(d => d > confDate && d <= `${analysisYear}-${mm}-31`);
          if (!nd) continue; // no trading day in that month after confDate
          refIdx = dateIdx[nd];
        }
        if (refIdx === undefined || refIdx >= ohlc.length-1) continue;

        const hasH   = arr.some(e => e.type==='H');
        const hasL   = arr.some(e => e.type==='L');
        const cfType = (hasH&&hasL) ? 'HL' : hasH ? 'H' : 'L';

        const baseFields = {
          sym,
          analysisYear,
          month:    MONTH_NAMES[mi],
          confDate,
          cfType,
          cfCount:  arr.length,
          cfYears:  arr.map(e=>`${e.year}${e.type}`).join('|'),
        };

        if (verbose) {
          const nd = ohlc[refIdx];
          console.log(`\n  Confluence: ${confDate} (${cfType} x${arr.length}) [${arr.map(e=>`${e.year}${e.type}`).join(', ')}]`);
          console.log(`  Ref bar  : ${nd.date}  H=${nd.high}  L=${nd.low}`);
          if (refIdx+1 < ohlc.length) {
            const eb = ohlc[refIdx+1];
            console.log(`  Entry bar: ${eb.date}  O=${eb.open}  H=${eb.high}  L=${eb.low}  C=${eb.close}`);
          }
        }

        for (const dir of ['LONG','SHORT']) {
          const t = simulateTrade(ohlc, refIdx, dir, hasIntraday ? intradayByDate : null, rawDateMap);
          if (!t) continue;
          // Mark live if: (a) SL not yet hit AND fewer than MAX_BARS bars available from entry
          // — outcome is incomplete so don't count in historical stats
          const entryIdx2 = refIdx + 1;
          const isLive = t.outcome === 'timeout' && (entryIdx2 + MAX_BARS > ohlc.length - 1);
          trades.push({ ...baseFields, ...t, live: isLive ? 'Y' : 'N' });
        }
      }
    }
  }

  return trades;
}

// ── Statistics ────────────────────────────────────────────────────────
function stats(trades) {
  if (!trades.length) return { n:0 };
  const hist = trades.filter(t => t.live==='N');
  if (!hist.length) return { n:0, live: trades.length };
  const wins   = hist.filter(t => t.pnlPct > 0).length;
  const losses = hist.filter(t => t.pnlPct <= 0).length;
  const avgR   = hist.reduce((s,t)=>s+t.rMult, 0) / hist.length;
  const avgW   = hist.filter(t=>t.pnlPct>0).reduce((s,t)=>s+t.rMult,0) / (wins||1);
  const avgL   = hist.filter(t=>t.pnlPct<=0).reduce((s,t)=>s+t.rMult,0) / (losses||1);
  const slCount = hist.filter(t=>t.outcome==='SL').length;
  return {
    n: hist.length, live: trades.length - hist.length,
    wins, losses, wr: wins/hist.length,
    avgR, avgW, avgL, slCount,
    slPct: slCount/hist.length,
  };
}

// ── HTML report ───────────────────────────────────────────────────────
function buildHTML(allTrades) {
  const hist = allTrades.filter(t => t.live==='N');
  const live = allTrades.filter(t => t.live==='Y');

  // Per-symbol summary
  const symMap = {};
  hist.forEach(t => {
    if (!symMap[t.sym]) symMap[t.sym] = { LONG:[], SHORT:[] };
    symMap[t.sym][t.dir].push(t);
  });

  function pctCls(v) { return v>0?'pos':v<0?'neg':'neu'; }
  function pct(v) { return `${v>0?'+':''}${v.toFixed(1)}%`; }
  function r(v) { return `${v>0?'+':''}${v.toFixed(2)}R`; }

  const rows = Object.entries(symMap).map(([sym, d]) => {
    const s = {
      LONG:  stats(d.LONG.map(t=>({...t,live:'N'}))),
      SHORT: stats(d.SHORT.map(t=>({...t,live:'N'}))),
    };
    const total = (s.LONG.n||0) + (s.SHORT.n||0);
    const totalW = (s.LONG.wins||0) + (s.SHORT.wins||0);
    const overallWR = total ? totalW/total : 0;
    const overallR  = total ? ((s.LONG.avgR||0)*(s.LONG.n||0)+(s.SHORT.avgR||0)*(s.SHORT.n||0)) / total : 0;
    return `
<tr>
  <td class="sym">${sym}</td>
  <td>${total}</td>
  <td class="${pctCls(overallWR-0.5)}">${(overallWR*100).toFixed(0)}%</td>
  <td class="${pctCls(overallR)}">${overallR.toFixed(2)}R</td>
  <td>${s.LONG.n||0} / ${((s.LONG.wr||0)*100).toFixed(0)}% / ${(s.LONG.avgR||0).toFixed(2)}R</td>
  <td>${s.SHORT.n||0} / ${((s.SHORT.wr||0)*100).toFixed(0)}% / ${(s.SHORT.avgR||0).toFixed(2)}R</td>
</tr>`;
  }).join('');

  // Live signals table
  const liveRows = live.map(t => `
<tr>
  <td class="sym">${t.sym}</td>
  <td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType} (×${t.cfCount})</td>
  <td>${t.cfYears}</td>
  <td>${t.dir==='LONG'?'🔼':'🔽'} <strong>${t.dir}</strong></td>
  <td>${t.refDate}</td>
  <td>${t.entryDate}</td>
  <td>${t.ep}</td>
  <td>${t.sl}</td>
  <td class="${t.dir==='LONG'?'pos':'neg'}">${t.dir==='LONG'?'+':'-'}${((Math.abs(t.ep-t.sl)/t.ep)*100).toFixed(2)}%</td>
</tr>`).join('');

  // All historical trades table
  const tradeRows = hist.map(t => `
<tr>
  <td class="sym">${t.sym}</td>
  <td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType}</td>
  <td>${t.dir==='LONG'?'🔼':'🔽'} ${t.dir}</td>
  <td>${t.refDate}</td>
  <td>${t.entryDate}</td>
  <td style="color:var(--sub)">${t.entryTime}</td>
  <td>${t.ep}</td>
  <td>${t.sl}</td>
  <td>${t.exitDate}</td>
  <td class="${pctCls(t.pnlPct)}">${pct(t.pnlPct)}</td>
  <td class="${pctCls(t.rMult)}">${r(t.rMult)}</td>
  <td>${t.maxFavPct}%</td>
  <td>${t.outcome==='SL'?'<span class="sl-badge">SL</span>':'<span class="to-badge">Time</span>'}</td>
  <td>${t.barsHeld}d</td>
</tr>`).join('');

  // Overall stats by direction
  function dirStats(dir) {
    const t = hist.filter(x=>x.dir===dir);
    if (!t.length) return `<span>No trades</span>`;
    const s = stats(t.map(x=>({...x,live:'N'})));
    return `<b>${t.length}</b> trades &nbsp;|&nbsp; WR: <b class="${pctCls(s.wr-0.5)}">${(s.wr*100).toFixed(1)}%</b> &nbsp;|&nbsp; avgR: <b class="${pctCls(s.avgR)}">${s.avgR.toFixed(2)}</b> &nbsp;|&nbsp; SL hit: ${(s.slPct*100).toFixed(1)}%`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Confluence Backtest</title>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --accent:#58a6ff;
          --green:#3fb950; --red:#f85149; --text:#c9d1d9; --sub:#8b949e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; font-size:12px; }
  h1 { color:var(--accent); font-size:18px; padding:20px 24px 8px; }
  h2 { color:var(--accent); font-size:14px; padding:16px 24px 8px; border-top:1px solid var(--border); }
  .meta { color:var(--sub); padding:0 24px 16px; font-size:11px; }
  .stat-row { display:flex; gap:16px; padding:8px 24px 16px; flex-wrap:wrap; }
  .stat-box { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:10px 16px; font-size:12px; }
  .stat-box .lbl { color:var(--sub); font-size:10px; text-transform:uppercase; }
  .wrap { padding:0 24px 24px; overflow-x:auto; }
  table { border-collapse:collapse; width:100%; min-width:600px; }
  th { background:#1c2128; color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:8px 8px; border:1px solid var(--border); text-align:left; white-space:nowrap; }
  td { border:1px solid var(--border); padding:5px 8px; vertical-align:middle; white-space:nowrap; }
  tr:hover td { background:#1a2130; }
  .sym { font-weight:700; color:var(--accent); }
  .pos { color:var(--green); font-weight:600; }
  .neg { color:var(--red); font-weight:600; }
  .neu { color:var(--sub); }
  .sl-badge { background:#2d1010; color:var(--red); border:1px solid #4a1a1a; border-radius:3px; padding:1px 5px; font-size:10px; font-weight:700; }
  .to-badge { background:#0d2818; color:var(--green); border:1px solid #1a4a28; border-radius:3px; padding:1px 5px; font-size:10px; font-weight:700; }
  .live-badge { background:#2d1a00; color:#e3b341; border:1px solid #6a4a00; border-radius:3px; padding:1px 6px; font-size:10px; font-weight:700; margin-left:6px; }
  input[type=text] { background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px 8px; border-radius:4px; font-size:11px; width:160px; }
</style>
</head>
<body>
<h1>Gann Confluence Backtest <span class="live-badge">LIVE</span></h1>
<div class="meta">
  ZigZag dev=4% dep=10 · Analysis years ${ANALYSIS_YEARS[0]}–${ANALYSIS_YEARS[ANALYSIS_YEARS.length-1]} · Exit: SL or ${MAX_BARS} trading bars · Daily data (approx. hourly breakout)
</div>

<div class="stat-row">
  <div class="stat-box"><div class="lbl">LONG trades</div>${dirStats('LONG')}</div>
  <div class="stat-box"><div class="lbl">SHORT trades</div>${dirStats('SHORT')}</div>
</div>

${live.length ? `
<h2>Live Signals <span class="live-badge">${live.length} open</span></h2>
<div class="wrap">
<table>
<thead><tr>
  <th>Symbol</th><th>Year</th><th>CF Date</th><th>Type</th><th>Lookback Years</th>
  <th>Dir</th><th>Ref Bar</th><th>Entry Bar</th><th>Entry ₹</th><th>SL ₹</th><th>Risk%</th>
</tr></thead>
<tbody>${liveRows}</tbody>
</table>
</div>
` : ''}

<h2>Per-Symbol Summary (historical)</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="sym-filter" placeholder="type symbol…" oninput="filterSym(this.value)"></p>
<table id="sym-table">
<thead><tr>
  <th>Symbol</th><th>Total</th><th>WR</th><th>Avg R</th>
  <th>LONG (n / WR / avgR)</th><th>SHORT (n / WR / avgR)</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</div>

<h2>All Historical Trades</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="trade-filter" placeholder="symbol / year / month…" oninput="filterTrades(this.value)"></p>
<table id="trade-table">
<thead><tr>
  <th>Symbol</th><th>Year</th><th>CF Date</th><th>Type</th><th>Dir</th>
  <th>Ref Bar</th><th>Entry Bar</th><th>Entry Time</th><th>Entry ₹</th><th>SL ₹</th>
  <th>Exit Date</th><th>P&amp;L%</th><th>R-Mult</th><th>Max Fav%</th><th>Exit</th><th>Held</th>
</tr></thead>
<tbody>${tradeRows}</tbody>
</table>
</div>

<script>
function filterSym(v) {
  const lv = v.toLowerCase();
  document.querySelectorAll('#sym-table tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(lv) ? '' : 'none';
  });
}
function filterTrades(v) {
  const lv = v.toLowerCase();
  document.querySelectorAll('#trade-table tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(lv) ? '' : 'none';
  });
}
</script>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const symArg  = args.find(a => !a.startsWith('--'))?.toUpperCase();
  const dirArg  = args.includes('--dir') ? args[args.indexOf('--dir')+1]?.toUpperCase() : null;
  const verbose = !!symArg; // verbose mode when single symbol requested

  const syms = symArg ? [symArg] : ALL_SYMS;

  console.log('═'.repeat(70));
  console.log('  Gann Confluence Backtest');
  console.log(`  ZigZag dev=${DEV}% dep=${DEP}  |  Exit: SL or ${MAX_BARS} bars`);
  console.log(`  Analysis years: ${ANALYSIS_YEARS.join(', ')}`);
  if (dirArg) console.log(`  Direction filter: ${dirArg}`);
  console.log('═'.repeat(70));

  const allTrades = [];

  for (const sym of syms) {
    process.stdout.write(`  ${sym.padEnd(14)} `);
    let trades = backtestSym(sym, verbose);
    if (dirArg) trades = trades.filter(t => t.dir === dirArg);
    allTrades.push(...trades);
    const hist = trades.filter(t=>t.live==='N');
    const live = trades.filter(t=>t.live==='Y');
    const wins = hist.filter(t=>t.pnlPct>0).length;
    const wr   = hist.length ? `WR:${((wins/hist.length)*100).toFixed(0)}%` : 'WR:n/a';
    const avgR = hist.length ? `avgR:${(hist.reduce((s,t)=>s+t.rMult,0)/hist.length).toFixed(2)}` : '';
    console.log(`${hist.length} hist  ${live.length} live  ${wr}  ${avgR}`);
  }

  console.log('─'.repeat(70));

  // Overall stats
  const hist = allTrades.filter(t=>t.live==='N');
  for (const dir of ['LONG','SHORT']) {
    const dt = hist.filter(t=>t.dir===dir);
    if (!dt.length) continue;
    const wins = dt.filter(t=>t.pnlPct>0).length;
    const avgR = dt.reduce((s,t)=>s+t.rMult,0)/dt.length;
    const slPct = dt.filter(t=>t.outcome==='SL').length/dt.length;
    console.log(`  ${dir.padEnd(6)} ${dt.length} trades  WR:${((wins/dt.length)*100).toFixed(1)}%  avgR:${avgR.toFixed(2)}  SL%:${(slPct*100).toFixed(1)}%`);
  }
  const live = allTrades.filter(t=>t.live==='Y');
  if (live.length) {
    console.log(`\n  ── Live signals (${live.length}) ──`);
    live.forEach(t => {
      console.log(`  ${t.sym.padEnd(14)} ${t.analysisYear} ${t.month} ${t.confDate.substring(8)} ${t.cfType}×${t.cfCount}  ${t.dir.padEnd(6)} entry:${t.entryDate} ep:${t.ep} sl:${t.sl}`);
    });
  }

  if (allTrades.length && !symArg) {
    // Write CSV
    const headers = Object.keys(allTrades[0]);
    const csv = [headers.join(','), ...allTrades.map(t => headers.map(h => t[h]).join(','))].join('\n') + '\n';
    fs.writeFileSync(OUT_CSV, csv, 'utf8');
    console.log(`\n  → CSV: ${OUT_CSV}`);

    // Write HTML
    fs.writeFileSync(OUT_HTML, buildHTML(allTrades), 'utf8');
    console.log(`  → HTML: ${OUT_HTML}`);
  }

  console.log('═'.repeat(70));
}

main();
