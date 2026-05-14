#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Gann Dashboard — Fetch Adjusted Historical OHLC from Yahoo Finance
// ─────────────────────────────────────────────────────────────
// Downloads split/bonus/dividend-adjusted OHLC for all 75 instruments.
// Adjustment: adjClose/close ratio applied to open, high, low so all
// historical prices are comparable across corporate actions.
//
// Output: j:/Swing Trading/Swing Trading/processed_adj/SYMBOL.csv
//
// Usage:
//   node fetch_adjusted.js              — fetch all 75 symbols
//   node fetch_adjusted.js RELIANCE     — fetch single symbol
//   node fetch_adjusted.js --verify     — print date range summary only
// ─────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const OUT_DIR  = 'j:/Swing Trading/Swing Trading/processed_adj';
const START    = '2000-01-01';
const END      = new Date().toISOString().split('T')[0];

// ── Symbol → Yahoo Finance ticker ────────────────────────────
// NSE stocks use .NS suffix. Special chars are handled by yahoo-finance2.
const YF_OVERRIDES = {
  'M&M':      'M%26M.NS',   // Mahindra & Mahindra
};

function toYFSym(sym) {
  return YF_OVERRIDES[sym] || (sym + '.NS');
}

// ── All 75 tracked instruments ────────────────────────────────
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

// ── Fetch one symbol ──────────────────────────────────────────
async function fetchSymbol(sym) {
  const yfSym = toYFSym(sym);
  let raw;
  try {
    raw = await yf.historical(yfSym, {
      period1:  START,
      period2:  END,
      interval: '1d',
      events:   'history',
    }, { validateResult: false });
  } catch (e) {
    return { sym, status: 'error', msg: e.message };
  }

  if (!raw || !raw.length) {
    return { sym, status: 'empty' };
  }

  // Apply split/bonus adjustment: adjClose/close ratio scales all OHLC
  const rows = raw
    .filter(d => d.close && d.adjClose && d.high && d.low)
    .map(d => {
      const factor = d.adjClose / d.close;
      const date   = d.date.toISOString().split('T')[0];
      return {
        date,
        open:   +(d.open  * factor).toFixed(2),
        high:   +(d.high  * factor).toFixed(2),
        low:    +(d.low   * factor).toFixed(2),
        close:  +(d.adjClose).toFixed(2),
        volume: d.volume || 0,
      };
    })
    .filter(r => r.high > 0 && r.low > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!rows.length) return { sym, status: 'empty' };

  const csv = `Symbol,Date,Open,High,Low,Close,Volume\n` +
    rows.map(r => `${sym},${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}`).join('\n') + '\n';

  const outPath = path.join(OUT_DIR, `${sym}.csv`);
  fs.writeFileSync(outPath, csv, 'utf8');

  return {
    sym,
    status: 'ok',
    rows:   rows.length,
    first:  rows[0].date,
    last:   rows[rows.length - 1].date,
  };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify');

  if (verifyOnly) {
    console.log('── Verify mode: reading existing processed_adj/ files ──');
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.csv'));
    files.sort().forEach(f => {
      const sym   = f.replace('.csv','');
      const lines = fs.readFileSync(path.join(OUT_DIR, f), 'utf8').trim().split('\n');
      const first = lines[1]?.split(',')[1];
      const last  = lines[lines.length-1]?.split(',')[1];
      console.log(`  ${sym.padEnd(14)} ${lines.length - 1} rows  ${first} → ${last}`);
    });
    return;
  }

  // Determine which symbols to fetch
  const targets = args.filter(a => !a.startsWith('--')).map(a => a.toUpperCase());
  const syms = targets.length ? targets : ALL_SYMS;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('═'.repeat(60));
  console.log('  Gann — Fetch Adjusted OHLC from Yahoo Finance');
  console.log(`  ${syms.length} symbol(s) | ${START} → ${END}`);
  console.log('═'.repeat(60));

  const results = { ok: 0, error: 0, empty: 0 };

  for (const sym of syms) {
    process.stdout.write(`  ${sym.padEnd(14)} `);
    const r = await fetchSymbol(sym);
    if (r.status === 'ok') {
      console.log(`✓  ${r.rows} rows  ${r.first} → ${r.last}`);
      results.ok++;
    } else if (r.status === 'empty') {
      console.log(`⚠  no data returned`);
      results.empty++;
    } else {
      console.log(`✗  ${r.msg}`);
      results.error++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('═'.repeat(60));
  console.log(`  Done. OK: ${results.ok}  Empty: ${results.empty}  Errors: ${results.error}`);
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
