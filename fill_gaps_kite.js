#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// fill_gaps_kite.js — Top up Yahoo-adjusted daily CSVs from Kite
// ─────────────────────────────────────────────────────────────────────
// Yahoo sometimes lags a day or two (partial null-close rows, SME/BSE
// gaps). After fetch_adjusted.js / fetch_cash_ohlc.js run, this appends
// Kite daily candles for any dates after a CSV's last row, up to the
// latest trading date seen across the directory. Symbols with no CSV at
// all (Yahoo has nothing) get a fresh CSV from Kite; build_swing_rs.js
// still uses parquet for history before it.
//
// The next Yahoo run rewrites each CSV in full, so these rows are only a
// stopgap until Yahoo catches up.
//
// Usage: node fill_gaps_kite.js
// ─────────────────────────────────────────────────────────────────────

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CONFIG_PATH = 'j:/GANN Claude/kite_config.json';
const NEW_CSV_FROM = '2023-01-01';
const DELAY_MS     = 350;

// Dashboard symbol → current Kite tradingsymbol, where NSE has renamed it
const KITE_ALIASES = {
  'HEG': 'HEGAM',   // HEG Ltd → HEG Advanced Materials
};

const TARGETS = [
  { dir: 'j:/Swing Trading/Swing Trading/processed_adj',      mod: './fetch_adjusted.js' },
  { dir: 'j:/Swing Trading/Swing Trading/processed_adj_cash', mod: './fetch_cash_ohlc.js' },
];

const delay = ms => new Promise(r => setTimeout(r, ms));

function kiteGet(urlPath, cfg) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.kite.trade', path: urlPath, method: 'GET',
      headers: { 'Authorization': `token ${cfg.api_key}:${cfg.access_token}`, 'X-Kite-Version': '3' },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// tradingsymbol → token, per exchange (EQ only)
async function loadInstruments(exch, cfg) {
  const res = await kiteGet(`/instruments/${exch}`, cfg);
  if (res.status !== 200) throw new Error(`${exch} instruments HTTP ${res.status}: ${res.body.substring(0, 200)}`);
  const lines = res.body.trim().split('\n');
  const h = lines[0].split(',');
  const iTok = h.indexOf('instrument_token'), iSym = h.indexOf('tradingsymbol'), iType = h.indexOf('instrument_type');
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[iType] === 'EQ') map[c[iSym]] = c[iTok];
  }
  return map;
}

// Resolve a dashboard symbol to a Kite token, following the Yahoo ticker
// (e.g. VALIANT → VALIANTLAB.NS, ZELIO → ZELIO.BO) and NSE series suffixes.
function resolveToken(sym, yfSym, instr) {
  const base = KITE_ALIASES[sym] || decodeURIComponent(yfSym).replace(/\.(NS|BO)$/, '');
  const nse  = [base, sym, ...['-SM', '-ST', '-BE', '-BZ'].map(s => base + s)];
  const order = yfSym.endsWith('.BO')
    ? [['BSE', [base, sym]], ['NSE', nse]]
    : [['NSE', nse], ['BSE', [base, sym]]];
  for (const [exch, names] of order)
    for (const n of names)
      if (instr[exch][n]) return { exch, name: n, token: instr[exch][n] };
  return null;
}

function lastDate(csvPath) {
  if (!fs.existsSync(csvPath)) return null;
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  return lines.length > 1 ? lines[lines.length - 1].split(',')[1] : null;
}

function addDays(d, n) {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().split('T')[0];
}

async function fetchDaily(token, from, to, cfg) {
  const res = await kiteGet(`/instruments/historical/${token}/day?from=${from}+00:00:00&to=${to}+23:59:59`, cfg);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${res.body.substring(0, 120)}`);
  const data = JSON.parse(res.body);
  if (data.status !== 'success') throw new Error(data.message);
  return (data.data?.candles || []).map(([ts, o, h, l, c, v]) =>
    ({ date: ts.substring(0, 10), open: o, high: h, low: l, close: c, volume: v || 0 }));
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!cfg.api_key || !cfg.access_token) {
    console.error('  Kite token not set — run: node fetch_intraday_kite.js --login');
    process.exit(1);
  }
  const instr = { NSE: await loadInstruments('NSE', cfg), BSE: await loadInstruments('BSE', cfg) };

  for (const { dir, mod } of TARGETS) {
    const { ALL_SYMS, toYFSym } = require(mod);
    const syms = [...new Set([
      ...ALL_SYMS,
      ...fs.readdirSync(dir).filter(f => f.endsWith('.csv')).map(f => f.slice(0, -4)),
    ])];
    const lasts = Object.fromEntries(syms.map(s => [s, lastDate(path.join(dir, `${s}.csv`))]));
    const target = Object.values(lasts).filter(Boolean).sort().pop();

    console.log('═'.repeat(65));
    console.log(`  Kite gap fill — ${path.basename(dir)}  (target ${target})`);
    console.log('═'.repeat(65));
    const res = { filled: 0, upToDate: 0, notFound: 0, noData: 0, error: 0 };

    for (const sym of syms.sort()) {
      const last = lasts[sym];
      if (last && last >= target) { res.upToDate++; continue; }
      // Skip long-dead CSVs (delisted/renamed) — not a Yahoo lag
      if (last && last < addDays(target, -60)) { res.upToDate++; continue; }

      const k = resolveToken(sym, toYFSym(sym), instr);
      if (!k) { console.log(`  ${sym.padEnd(14)} ✗  not found on Kite NSE/BSE`); res.notFound++; continue; }

      const from = last ? addDays(last, 1) : NEW_CSV_FROM;
      try {
        await delay(DELAY_MS);
        const rows = (await fetchDaily(k.token, from, target, cfg))
          .filter(r => r.date >= from && r.date <= target && r.high > 0 && r.low > 0);
        if (!rows.length) { console.log(`  ${sym.padEnd(14)} ⚠  no Kite candles ${from} → ${target}`); res.noData++; continue; }

        const csvPath = path.join(dir, `${sym}.csv`);
        const body = rows.map(r => `${sym},${r.date},${r.open},${r.high},${r.low},${r.close},${r.volume}`).join('\n') + '\n';
        if (last) fs.appendFileSync(csvPath, body);
        else fs.writeFileSync(csvPath, 'Symbol,Date,Open,High,Low,Close,Volume\n' + body);
        console.log(`  ${sym.padEnd(14)} ✓  +${rows.length} rows  ${rows[0].date} → ${rows[rows.length - 1].date}  (${k.exch}:${k.name}${last ? '' : ', new CSV'})`);
        res.filled++;
      } catch (e) {
        console.log(`  ${sym.padEnd(14)} ✗  ${e.message}`);
        res.error++;
      }
    }
    console.log(`  Done. Filled:${res.filled}  Up-to-date:${res.upToDate}  Not-found:${res.notFound}  No-data:${res.noData}  Errors:${res.error}`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
