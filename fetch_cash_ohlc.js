#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// fetch_cash_ohlc.js — Fetch adjusted OHLC for all Cash Stocks symbols
// Output: j:/Swing Trading/Swing Trading/processed_adj_cash/SYMBOL.csv
//
// Usage:
//   node fetch_cash_ohlc.js              — fetch all symbols
//   node fetch_cash_ohlc.js KPIL         — fetch single symbol
//   node fetch_cash_ohlc.js --verify     — print date range summary
// ─────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');
const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const OUT_DIR = 'j:/Swing Trading/Swing Trading/processed_adj_cash';
const START   = '2000-01-01';
const END     = new Date().toISOString().split('T')[0];

// ── Ticker overrides (BSE-only or special chars) ──────────────
const YF_OVERRIDES = {
  'GVTD':      'GVT%26D.NS',   // GVT&D on NSE
  'YASHHV':    'YASHHV.BO',
  'RAJESH':    'RAJESHEXPO.NS',
  'VALIANT':   'VALIANTLAB.NS',
  'VIPULORG':  'VIPULORG.BO',
  'CFF':       'CFF.BO',
  'CNCRD':     'CNCRD.BO',
  'KPL':       'KPL.BO',
  'DECNGOLD':  'DECNGOLD.BO',
  'JKBANK':    'J%26KBANK.NS', // J&K Bank — & must be encoded
  'ZELIO':     'ZELIO.BO',
  'BETA':      'BETA.BO',
  'SIKA':      'SIKA.BO',
  'AMIC':      'AMIC.BO',
  'COCKERILL': 'COCKERILL.BO',
};

function toYFSym(sym) {
  return YF_OVERRIDES[sym] || (sym + '.NS');
}

// ── All unique symbols from INSTRUMENTS + INVEST_DOMAIN ───────
const ALL_SYMS = [
  'AADHARHFC','ABSMARINE','ABSLAMC','ACCENTMIC','ADANIENT','ADANIENSOL',
  'ADANIPOWER','AEROFLEX','AETHER','AIMTRON','ANGELONE','APLAPOLLO','APEX',
  'ARIES','ARVIND','ASKAUTOLTD','ASTEC','ASTERDM','ASTRAMICRO','ATALREAL',
  'ATGL','AVALON','AVANTIFEED','AXISCADES','AZAD','BAJAJCON','BANCOINDIA',
  'BBOX','BHEL','BLACKBUCK','BLISSGVS','BSE','CARERATING','CARRARO','CARYSIL',
  'CCL','CENTUM','CFF','CHENNPETRO','CNCRD','CUMMINSIND','CUPID','DANISH',
  'DATAMATICS','DATAPATTNS','DCMSHRIRAM','DECNGOLD','DEEPAKFERT','DEEPINDS',
  'DEEDEV','DIACABS','DRREDDY','DREDGECORP','DSSL','DYNAMATECH','EMCURE',
  'ELECON','ENDURANCE','EQUITASBNK','ESABINDIA','EXIDEIND','FCL','FEDERALBNK','FIEMIND',
  'FLUOROCHEM','GAIL','GENUSPOWER','GESHIP','GICRE','GLAND','GLENMARK',
  'GMDCLTD','GMBREW','GOCLCORP','GODAVARIB','GOODLUCK','GOKULAGRO','GPIL',
  'GRANULES','GRAPHITE','GRASIM','GRSE','GRMOVER','GRWRHITECH','GUJALKALI',
  'GVTD','HAPPYFORGE','HBLENGINE','HEG','HFCL','HIRECT','IFCI','IMFA',
  'INDIAGLYCO','INDOBORAX','INOXINDIA','INTERARCH','IPCALAB','JAMNAAUTO',
  'JAYNECOIND','JMFINANCIL','JSFB','JSLL','KERNEX','KIOCL','KIRLPNU',
  'KIRLOSENG','KMEW','KOLTEPATIL','KPL','KPIL','KPIGREEN','KPRMILL','KRN',
  'KRISHANA','KSL','KTKBANK','KINGFA','LINDEINDIA','LLOYDSENT','LLOYDSME',
  'LUMAXTECH','MANINDS','MANORAMA','MARINE','MAYURUNIQ','MBAPL','MOREPENLAB',
  'MTARTECH','NATIONALUM','NDRAUTO','NETWEB','NGLFINE','NLCINDIA','NORTHARC',
  'NTPC','NUVAMA','OLECTRA','ONEPOINT','PAISALO','PARAS','PFOCUS','POCL',
  'POWERINDIA','PRECWIRE','PREMEXPLN','PREMIERENE','PRIVISCL','PSPPROJECT',
  'RAIN','RAJESH','RANEHOLDIN','ROSSTECH','RRKABEL','SAILIFE','SANDHAR',
  'SANDUMA','SANGAMIND','SANSERA','SATIN','SCHNEIDER','SCI','SEAMECLTD',
  'SENORES','SHAILY','SHARDACROP','SHILCTECH','SHILPAMED','SHRIPISTON',
  'SHYAMMETL','SJS','SKIPPER','SKYGOLD','SMSPHARMA','SOUTHBANK','SOUTHWEST',
  'SPORTKING','SSEGL','SSWL','STAR','STARHEALTH','STLTECH','SUNFLAG',
  'SURYODAY','SUZLON','SYRMA','TATACOMM','TDPOWERSYS','TECHNOE','THERMAX',
  'THYROCARE','TI','TIPSMUSIC','TMB','TRENT','TUNWAL','TVSHLTD','UJJIVANSFB',
  'UNIVCABLES','VALIANT','VILAS','VINDHYATEL','VISHNU','VIVIANA','VIPULORG',
  'VTL','WAAREEENER','WABAG','WELENT','WHEELS','WOCKPHARMA','YASHHV',
  'YATHARTH','ZENTEC','ZFCVINDIA','ZYDUSWELL',
  // ── Added 2026-07-01 (from watchlists) ──────────────────────
  'ABDL','ACMESOLAR','ADANIPORTS','ADVAIT','AEGISLOG','AEQUS','AGI',
  'AMAGI','ANURAS','APOLLO','ARFIN','ARSSBL','ASIANENE','ATHERENERG','AYE',
  'BALAMINES','BANDHANBNK','BANKINDIA','BELRISE','BETA','BRIGADE',
  'CARTRADE','CEMPRO','COCHINSHIP','COCKERILL','CPPLUS','CUB',
  'DHANBANK','DYCL','EBGNG','EIEL','EMMVEE','ENGINERSIN','ETERNAL',
  'GABRIEL','GAEL','GAUDIUMIVF','GROWW','GUJTHEM',
  'HALEOSLABS','HSCL','INDHOTEL','INDSWFTLAB',
  'JKBANK','JTLIND','KRISHNADEF','LENSKART','LODHA',
  'MAHABANK','MAXESTATES','NACLIND','NAZARA','NRBBEARING',
  'OLAELEC','ONESOURCE','PTCIL','QPOWER',
  'RAMCOIND','RAMCOSYS','RATEGAIN','RAYMONDREL','RISHABH',
  'SASKEN','SBCL','SEDEMAC','SEIL','SHADOWFAX','SHREEPUSHK','SIKA','SKMEGGPROD',
  'SOLARINDS','SOTL','SUDEEPPHRM','SUPRIYA','SURYAROSNI','SUVEN',
  'TALBROAUTO','TEJASNET','UTLSOLAR','VBL','VIYASH','YASHO',
  'ZELIO','AMIC',
];

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
    return { sym, status: 'error', msg: e.message.substring(0, 80) };
  }

  if (!raw || !raw.length) return { sym, status: 'empty' };

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

  fs.writeFileSync(path.join(OUT_DIR, `${sym}.csv`), csv, 'utf8');

  return { sym, status: 'ok', rows: rows.length, first: rows[0].date, last: rows[rows.length-1].date };
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--verify')) {
    console.log('── Verify: processed_adj_cash/ ──');
    if (!fs.existsSync(OUT_DIR)) { console.log('  Directory not found'); return; }
    fs.readdirSync(OUT_DIR).filter(f=>f.endsWith('.csv')).sort().forEach(f => {
      const lines = fs.readFileSync(path.join(OUT_DIR,f),'utf8').trim().split('\n');
      const sym   = f.replace('.csv','');
      const first = lines[1]?.split(',')[1];
      const last  = lines[lines.length-1]?.split(',')[1];
      console.log(`  ${sym.padEnd(14)} ${(lines.length-1).toString().padStart(5)} rows  ${first} -> ${last}`);
    });
    return;
  }

  const targets = args.filter(a=>!a.startsWith('--')).map(a=>a.toUpperCase());
  const syms = targets.length ? targets : ALL_SYMS;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('='.repeat(60));
  console.log('  Cash Stocks — Fetch Adjusted OHLC from Yahoo Finance');
  console.log(`  ${syms.length} symbol(s) | ${START} -> ${END}`);
  console.log('='.repeat(60));

  const results = { ok:0, empty:0, error:0 };

  for (const sym of syms) {
    process.stdout.write(`  ${sym.padEnd(14)} `);
    const r = await fetchSymbol(sym);
    if (r.status === 'ok') {
      console.log(`OK  ${r.rows} rows  ${r.first} -> ${r.last}`);
      results.ok++;
    } else if (r.status === 'empty') {
      console.log(`--  no data`);
      results.empty++;
    } else {
      console.log(`ERR ${r.msg}`);
      results.error++;
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('='.repeat(60));
  console.log(`  Done. OK:${results.ok}  Empty:${results.empty}  Errors:${results.error}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
