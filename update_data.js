#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Gann Dashboard — Daily Data Updater
// ─────────────────────────────────────────────────────────────
// Steps:
//   1. Download any missing NSE bhavcopy files → nse-bhavdata/YYYY/
//   2. Parse new bhavcopy rows, append to processed/SYMBOL.csv
//   3. Re-fetch adjusted OHLC for all symbols from Yahoo Finance → processed_adj/
//   4. Refresh 60-min intraday data from Kite API → processed_intraday/ (if token set)
//   5. Rebuild trial_natural_cycle.html + all ZigZag chart HTMLs
//
// Usage:  node update_data.js
//         node update_data.js --download-only
//         node update_data.js --rebuild-only
// ─────────────────────────────────────────────────────────────

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const { execSync } = require('child_process');

// ── Paths ─────────────────────────────────────────────────────
const BHAVDATA_DIR  = 'j:/Swing Trading/Swing Trading/nse-bhavdata';
const PROCESSED_DIR = 'j:/Swing Trading/Swing Trading/processed';
const GANN_DIR      = path.resolve(__dirname);

// ── NIFTY50 symbols to track (current NSE names) ──────────────
const NIFTY50_SYMS = new Set([
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
]);

// ── Midcap / Smallcap FNO symbols ────────────────────────────
const MIDCAP_SYMS = new Set([
  'ADANIPOWER','POONAWALLA','SUZLON','FEDERALBNK','PERSISTENT',
  'COFORGE','CANBK','SAIL','NMDC','RVNL','IRFC','MCX',
  'NATIONALUM','INDHOTEL','LTTS','MFSL','HUDCO','SRF',
  'POLYCAB','NHPC','SJVN','GMRINFRA','CONCOR',
  'COCHINSHIP','MAZDOCK',
]);

const ALL_TRACKED_SYMS = new Set([...NIFTY50_SYMS, ...MIDCAP_SYMS]);

// ── Helpers ───────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,'0'); }

function dateToFileStr(d) {
  // DDMMYYYY for filename
  return pad(d.getDate()) + pad(d.getMonth()+1) + d.getFullYear();
}

function dateToNSEStr(d) {
  // DD-Mon-YYYY for NSE API
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return pad(d.getDate()) + '-' + months[d.getMonth()] + '-' + d.getFullYear();
}

function fileStrToISO(s) {
  // "30-Mar-2026" → "2026-03-30"
  const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
                  Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  const [dd, mon, yyyy] = s.split('-');
  return `${yyyy}-${months[mon]}-${dd}`;
}

function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function bhavFilePath(d) {
  return path.join(BHAVDATA_DIR, String(d.getFullYear()),
    `sec_bhavdata_full_${dateToFileStr(d)}.csv`);
}

// ── Find last date in processed CSVs ─────────────────────────
function getLastProcessedDate() {
  // Check RELIANCE as a proxy (always present)
  const p = path.join(PROCESSED_DIR, 'RELIANCE.csv');
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p,'utf8').trim().split('\n');
  const last = lines[lines.length-1].split(',');
  return last[1]?.trim(); // "YYYY-MM-DD"
}

// ── NSE download with session cookie ─────────────────────────
function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getNSECookies() {
  console.log('  Initialising NSE session...');
  try {
    const res = await httpGet('https://www.nseindia.com', {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    });
    const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    return cookies;
  } catch (e) {
    console.warn('  Warning: Could not get NSE cookies:', e.message);
    return '';
  }
}

async function downloadBhav(d, cookies) {
  const filePath = bhavFilePath(d);
  if (fs.existsSync(filePath)) return 'exists';

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const dateStr = dateToNSEStr(d);
  const params = new URLSearchParams({
    archives: '[{"name":"Full Bhavcopy and Security Deliverable data","type":"daily-reports","category":"capital-market","section":"equities"}]',
    date: dateStr,
    type: 'equities',
    mode: 'single',
  });
  const url = `https://www.nseindia.com/api/reports?${params}`;

  try {
    const res = await httpGet(url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/all-reports',
      'Cookie': cookies,
    });

    if (res.status === 200 && res.body.includes('SYMBOL')) {
      fs.writeFileSync(filePath, res.body, 'utf8');
      return 'downloaded';
    } else if (res.status === 404) {
      return 'holiday';
    } else {
      return `skip:${res.status}`;
    }
  } catch (e) {
    return `error:${e.message}`;
  }
}

// ── Parse bhavcopy CSV, return map of symbol → row ───────────
function parseBhav(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim());

  const iSym   = headers.indexOf('SYMBOL');
  const iSer   = headers.indexOf('SERIES');
  const iDate  = headers.indexOf('DATE1');
  const iOpen  = headers.indexOf('OPEN_PRICE');
  const iHigh  = headers.indexOf('HIGH_PRICE');
  const iLow   = headers.indexOf('LOW_PRICE');
  const iClose = headers.indexOf('CLOSE_PRICE');
  const iVol   = headers.indexOf('TTL_TRD_QNTY');

  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols[iSer] !== 'EQ') continue;
    const sym = cols[iSym];
    if (!ALL_TRACKED_SYMS.has(sym)) continue;

    const isoDate = fileStrToISO(cols[iDate]);
    result[sym] = {
      symbol: sym,
      date:   isoDate,
      open:   parseFloat(cols[iOpen]  || 0),
      high:   parseFloat(cols[iHigh]  || 0),
      low:    parseFloat(cols[iLow]   || 0),
      close:  parseFloat(cols[iClose] || 0),
      volume: parseInt(cols[iVol]     || 0),
    };
  }
  return result;
}

// ── Append rows to processed CSVs ────────────────────────────
function appendToProcessed(rowsByDate) {
  // rowsByDate: [{date, sym, open, high, low, close, volume}, ...]
  // Group by symbol
  const bySym = {};
  rowsByDate.forEach(r => {
    if (!bySym[r.symbol]) bySym[r.symbol] = [];
    bySym[r.symbol].push(r);
  });

  let totalAppended = 0;
  for (const [sym, rows] of Object.entries(bySym)) {
    const filePath = path.join(PROCESSED_DIR, `${sym}.csv`);

    // Read existing dates to avoid duplicates
    let existingDates = new Set();
    let hasHeader = false;
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath,'utf8').trim().split('\n');
      hasHeader = lines.length > 0;
      lines.slice(1).forEach(l => {
        const d = l.split(',')[1]?.trim();
        if (d) existingDates.add(d);
      });
    }

    const newRows = rows
      .filter(r => !existingDates.has(r.date))
      .sort((a,b) => a.date.localeCompare(b.date));

    if (newRows.length === 0) continue;

    let appendText = '';
    if (!hasHeader) {
      appendText += 'Symbol,Date,Open,High,Low,Close,Volume,Pct_Change,Vol_Avg50,EMA10,EMA20,EMA50\n';
    }
    newRows.forEach(r => {
      // Append with blank indicator columns (they'll be filled by step2 if needed)
      appendText += `${r.symbol},${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume},,,,,\n`;
    });

    fs.appendFileSync(filePath, appendText, 'utf8');
    totalAppended += newRows.length;
    console.log(`  ${sym}: +${newRows.length} row(s) → ${[...existingDates].sort().slice(-1)[0]} → ${newRows[newRows.length-1].date}`);
  }
  return totalAppended;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const downloadOnly = args.includes('--download-only');
  const rebuildOnly  = args.includes('--rebuild-only');

  console.log('═'.repeat(60));
  console.log('  Gann Dashboard — Daily Data Updater');
  console.log('  ' + new Date().toLocaleString('en-IN'));
  console.log('═'.repeat(60));

  // ── STEP 1: Download missing bhavcopy files ────────────────
  if (!rebuildOnly) {
    console.log('\n[1/3] Downloading missing bhavcopy files...');

    const lastDate = getLastProcessedDate();
    const startFrom = lastDate
      ? addDays(new Date(lastDate), 1)
      : new Date('2026-01-01');
    const today = new Date();
    today.setHours(0,0,0,0);

    // Collect weekdays from startFrom to today
    const datesToCheck = [];
    for (let d = new Date(startFrom); d <= today; d = addDays(d,1)) {
      if (!isWeekend(d)) datesToCheck.push(new Date(d));
    }

    if (datesToCheck.length === 0) {
      console.log('  All bhavcopy files already up to date.');
    } else {
      console.log(`  Checking ${datesToCheck.length} trading day(s) from ${dateToNSEStr(startFrom)} to ${dateToNSEStr(today)}...`);
      const cookies = await getNSECookies();

      let downloaded = 0, holidays = 0, errors = 0;
      for (const d of datesToCheck) {
        const result = await downloadBhav(d, cookies);
        const label = `  ${dateToNSEStr(d)}:`;
        if (result === 'downloaded') { console.log(`${label} ✓ downloaded`); downloaded++; }
        else if (result === 'exists')  { /* silent */ }
        else if (result === 'holiday') { console.log(`${label} holiday/closed`); holidays++; }
        else { console.log(`${label} ${result}`); errors++; }
      }
      console.log(`  Done. Downloaded: ${downloaded}, Holidays/closed: ${holidays}, Errors: ${errors}`);
    }
  }

  if (downloadOnly) { console.log('\nDone (download only).'); return; }

  // ── STEP 2: Parse new bhavcopy files and update processed/ ─
  console.log('\n[2/3] Updating processed CSVs...');

  const lastDate = getLastProcessedDate();
  console.log(`  Last processed date: ${lastDate || 'unknown'}`);

  // Find all bhavcopy files newer than lastDate
  const newBhavFiles = [];
  for (const year of ['2024','2025','2026']) {
    const dir = path.join(BHAVDATA_DIR, year);
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir)
      .filter(f => f.endsWith('.csv'))
      .sort()
      .forEach(f => {
        // Extract date from filename: sec_bhavdata_full_DDMMYYYY.csv
        const m = f.match(/sec_bhavdata_full_(\d{2})(\d{2})(\d{4})\.csv/);
        if (!m) return;
        const isoDate = `${m[3]}-${m[2]}-${m[1]}`;
        if (!lastDate || isoDate > lastDate) {
          newBhavFiles.push({ path: path.join(dir, f), date: isoDate });
        }
      });
  }

  if (newBhavFiles.length === 0) {
    console.log('  No new bhavcopy files to process.');
  } else {
    console.log(`  Processing ${newBhavFiles.length} new bhavcopy file(s)...`);
    const allNewRows = [];
    for (const { path: fp, date } of newBhavFiles.sort((a,b) => a.date.localeCompare(b.date))) {
      try {
        const rows = parseBhav(fp);
        Object.values(rows).forEach(r => allNewRows.push(r));
      } catch(e) {
        console.warn(`  Warning: Could not parse ${path.basename(fp)}: ${e.message}`);
      }
    }
    const totalAppended = appendToProcessed(allNewRows);
    console.log(`  Total: ${totalAppended} row(s) appended across ${ALL_TRACKED_SYMS.size} stocks.`);
  }

  // ── STEP 3: Refresh adjusted OHLC from Yahoo Finance ──────
  console.log('\n[3/5] Refreshing adjusted OHLC from Yahoo Finance...');
  try {
    execSync(`node "${path.join(GANN_DIR, 'fetch_adjusted.js')}"`, { stdio:'inherit' });
  } catch(e) {
    console.error('  ✗ fetch_adjusted.js failed:', e.stderr?.toString() || e.message);
  }

  // ── STEP 4: Refresh intraday 60-min data from Kite ─────────
  const kiteCfg = path.join(GANN_DIR, 'kite_config.json');
  if (fs.existsSync(kiteCfg)) {
    const kc = JSON.parse(fs.readFileSync(kiteCfg,'utf8'));
    if (kc.api_key && kc.access_token) {
      console.log('\n[4/5] Refreshing 60-min intraday data from Kite...');
      try {
        execSync(`node "${path.join(GANN_DIR, 'fetch_intraday_kite.js')}"`, { stdio:'inherit' });
      } catch(e) {
        console.error('  ✗ fetch_intraday_kite.js failed:', e.stderr?.toString() || e.message);
        console.error('  → If token expired: node fetch_intraday_kite.js --login');
      }
    } else {
      console.log('\n[4/5] Kite token not set — skipping intraday update.');
      console.log('  → Run: node fetch_intraday_kite.js --login');
    }
  } else {
    console.log('\n[4/5] kite_config.json not found — skipping intraday update.');
  }

  // ── STEP 5: Rebuild HTML files ─────────────────────────────
  console.log('\n[5/5] Rebuilding HTML dashboards...');

  try {
    console.log('  Building trial_natural_cycle.html...');
    execSync(`node "${path.join(GANN_DIR, 'build_trial.js')}"`, { stdio:'pipe' });
    console.log('  ✓ trial_natural_cycle.html');
  } catch(e) {
    console.error('  ✗ build_trial.js failed:', e.stderr?.toString() || e.message);
  }

  try {
    console.log('  Building ZigZag charts (49 files)...');
    execSync(`node "${path.join(GANN_DIR, 'build_chart.js')}"`, { stdio:'pipe' });
    console.log('  ✓ All ZigZag charts + index.html');
  } catch(e) {
    console.error('  ✗ build_chart.js failed:', e.stderr?.toString() || e.message);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Update complete: ' + new Date().toLocaleString('en-IN'));
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
