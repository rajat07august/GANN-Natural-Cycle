// Builds Gann/6/trial_natural_cycle.html
// Two tabs: Natural Cycle + Confluence Calendar
// Shared: NIFTY_F, OHLC_DATA, ZigZag engine, cache
// node build_trial.js

const fs   = require('fs');
const path = require('path');

// ── Name mapping ──────────────────────────────────────────────
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

const INSTRUMENTS = [
  { sym:'NIFTY',      name:'NIFTY 50 (Index)',   isIndex:true },
  { sym:'ADANIENT',   name:'Adani Enterprises'               },
  { sym:'ADANIPORTS', name:'Adani Ports'                     },
  { sym:'APOLLOHOSP', name:'Apollo Hospitals'                },
  { sym:'ASIANPAINT', name:'Asian Paints'                    },
  { sym:'AXISBANK',   name:'Axis Bank'                       },
  { sym:'BAJAJ-AUTO', name:'Bajaj Auto'                      },
  { sym:'BAJAJFINSV', name:'Bajaj Finserv'                   },
  { sym:'BAJFINANCE', name:'Bajaj Finance'                   },
  { sym:'BHARTIARTL', name:'Bharti Airtel'                   },
  { sym:'BPCL',       name:'BPCL'                            },
  { sym:'BRITANNIA',  name:'Britannia'                       },
  { sym:'CIPLA',      name:'Cipla'                           },
  { sym:'COALINDIA',  name:'Coal India'                      },
  { sym:'DRREDDY',    name:"Dr. Reddy's"                     },
  { sym:'EICHERMOT',  name:'Eicher Motors'                   },
  { sym:'GRASIM',     name:'Grasim'                          },
  { sym:'HCLTECH',    name:'HCL Technologies'                },
  { sym:'HDFCBANK',   name:'HDFC Bank'                       },
  { sym:'HDFCLIFE',   name:'HDFC Life'                       },
  { sym:'HEROMOTOCO', name:'Hero MotoCorp'                   },
  { sym:'HINDALCO',   name:'Hindalco'                        },
  { sym:'HINDUNILVR', name:'Hindustan Unilever'              },
  { sym:'ICICIBANK',  name:'ICICI Bank'                      },
  { sym:'INDUSINDBK', name:'IndusInd Bank'                   },
  { sym:'INFY',       name:'Infosys'                         },
  { sym:'ITC',        name:'ITC'                             },
  { sym:'JSWSTEEL',   name:'JSW Steel'                       },
  { sym:'KOTAKBANK',  name:'Kotak Mahindra Bank'             },
  { sym:'LT',         name:'Larsen & Toubro'                 },
  { sym:'M&M',        name:'Mahindra & Mahindra'             },
  { sym:'MARUTI',     name:'Maruti Suzuki'                   },
  { sym:'NESTLEIND',  name:'Nestle India'                    },
  { sym:'NTPC',       name:'NTPC'                            },
  { sym:'ONGC',       name:'ONGC'                            },
  { sym:'POWERGRID',  name:'Power Grid'                      },
  { sym:'RELIANCE',   name:'Reliance Industries'             },
  { sym:'SBIN',       name:'SBI'                             },
  { sym:'SHRIRAMFIN', name:'Shriram Finance'                 },
  { sym:'SUNPHARMA',  name:'Sun Pharma'                      },
  { sym:'TATACONSUM', name:'Tata Consumer'                   },
  { sym:'TATAMOTORS', name:'Tata Motors'                     },
  { sym:'TATASTEEL',  name:'Tata Steel'                      },
  { sym:'TCS',        name:'TCS'                             },
  { sym:'TECHM',      name:'Tech Mahindra'                   },
  { sym:'TITAN',      name:'Titan'                           },
  { sym:'TRENT',      name:'Trent'                           },
  { sym:'ULTRACEMCO', name:'UltraTech Cement'                },
  { sym:'WIPRO',      name:'Wipro'                           },
  { sym:'ZOMATO',     name:'Zomato'                          },
];

const MIDCAP_INSTRUMENTS = [
  { sym:'ADANIPOWER',  name:'Adani Power'                  },
  { sym:'POONAWALLA',  name:'Poonawalla Fincorp'           },
  { sym:'SUZLON',      name:'Suzlon Energy'                },
  { sym:'FEDERALBNK',  name:'Federal Bank'                 },
  { sym:'PERSISTENT',  name:'Persistent Systems'           },
  { sym:'COFORGE',     name:'Coforge'                      },
  { sym:'CANBK',       name:'Canara Bank'                  },
  { sym:'SAIL',        name:'SAIL'                         },
  { sym:'NMDC',        name:'NMDC'                         },
  { sym:'RVNL',        name:'RVNL'                         },
  { sym:'IRFC',        name:'IRFC'                         },
  { sym:'MCX',         name:'MCX India'                    },
  { sym:'NATIONALUM',  name:'National Aluminium'           },
  { sym:'INDHOTEL',    name:'Indian Hotels'                },
  { sym:'LTTS',        name:'L&T Technology Services'      },
  { sym:'MFSL',        name:'Max Financial Services'       },
  { sym:'HUDCO',       name:'HUDCO'                        },
  { sym:'SRF',         name:'SRF'                          },
  { sym:'POLYCAB',     name:'Polycab India'                },
  { sym:'NHPC',        name:'NHPC'                         },
  { sym:'SJVN',        name:'SJVN'                         },
  { sym:'GMRINFRA',    name:'GMR Airports'                 },
  { sym:'CONCOR',      name:'Container Corporation'        },
  { sym:'COCHINSHIP',  name:'Cochin Shipyard'              },
  { sym:'MAZDOCK',     name:'Mazagon Dock'                 },
];

// ── CSV helpers ───────────────────────────────────────────────
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

const ADJ_DIR = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR = 'j:/Swing Trading/Swing Trading/processed';

let _src1Cache = null;
function getSrc1() {
  if (!_src1Cache) {
    console.error('Loading NIFTY50_all.csv...');
    _src1Cache = parseCSV(fs.readFileSync('j:/GANN Claude/Dataset/NIFTY50_all.csv','utf8'));
  }
  return _src1Cache;
}

function mergeRows(sym) {
  // Prefer adjusted data from Yahoo Finance
  const adjPath = path.join(ADJ_DIR, `${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return parseCSV(fs.readFileSync(adjPath, 'utf8'))
      .map(r => ({
        date:  (r.Date  || r.date  || '').trim(),
        open:  parseFloat(r.Open  || r.open  || 0),
        high:  parseFloat(r.High  || r.high  || 0),
        low:   parseFloat(r.Low   || r.low   || 0),
        close: parseFloat(r.Close || r.close || 0),
      }))
      .filter(r => r.date && r.high > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Fallback: merge NIFTY50_all.csv + bhavcopy processed/ (for symbols with no YF data)
  const histNames = HIST_NAMES[sym] || [sym];
  const symSet = new Set(histNames);
  const rows = getSrc1()
    .filter(r => symSet.has(r.Symbol))
    .map(r => ({
      date:  r.Date.trim(),
      open:  parseFloat(r.Open  || 0),
      high:  parseFloat(r.High  || 0),
      low:   parseFloat(r.Low   || 0),
      close: parseFloat(r.Close || 0),
    }))
    .filter(r => r.date && r.high > 0);
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const rows2 = parseCSV(fs.readFileSync(rawPath, 'utf8'))
      .map(r => ({
        date:  (r.Date  || r.date  || '').trim(),
        open:  parseFloat(r.Open  || r.open  || 0),
        high:  parseFloat(r.High  || r.high  || 0),
        low:   parseFloat(r.Low   || r.low   || 0),
        close: parseFloat(r.Close || r.close || 0),
      }))
      .filter(r => r.date && r.high > 0);
    const existing = new Set(rows.map(r => r.date));
    rows2.forEach(r => { if (!existing.has(r.date)) rows.push(r); });
  }
  return rows.filter(r => r.date >= '2000-01-01').sort((a,b) => a.date.localeCompare(b.date));
}

// ── Build OHLC data ───────────────────────────────────────────
const ALL_INSTRUMENTS = [...INSTRUMENTS, ...MIDCAP_INSTRUMENTS];
console.error('Processing NIFTY50 stocks...');
const ohlcBlocks = {};
for (const { sym, isIndex } of ALL_INSTRUMENTS) {
  if (isIndex) continue;
  const rows = mergeRows(sym);
  console.error(`  ${sym}: ${rows.length} rows (${rows[0]?.date} → ${rows[rows.length-1]?.date})`);
  ohlcBlocks[sym] = rows.map(r => `['${r.date}',${r.open.toFixed(2)},${r.high.toFixed(2)},${r.low.toFixed(2)},${r.close.toFixed(2)}]`).join(',');
}

const ohlcDataJS = ALL_INSTRUMENTS
  .filter(i => !i.isIndex)
  .map(({ sym }) => `  '${sym}':[${ohlcBlocks[sym]}]`)
  .join(',\n');

// ── Selector options ──────────────────────────────────────────
const instrOptionsNifty = INSTRUMENTS.map(({ sym, name }) =>
  `<option value="${sym}">${name}</option>`
).join('\n        ');

const instrOptionsMidcap = MIDCAP_INSTRUMENTS.map(({ sym, name }) =>
  `<option value="${sym}">${name}</option>`
).join('\n        ');

const yearOptions = Array.from({length:11}, (_,i) => 2020+i)
  .map(y => `<option value="${y}"${y===2026?' selected':''}>${y}</option>`).join('');

const monthOptions = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
  .map((m,i) => `<option value="${i}"${i===4?' selected':''}>${m}</option>`).join('');

// ── NIFTY_F ───────────────────────────────────────────────────
const NIFTY_F_JS = `{
  1995:['','','','','','','','','','','06 H / 29 L','28 H'],
  1996:['29 L','14 H','19 L','25 H','28 L','17 H','','','','08 L','','04 L'],
  1997:['16 H','03 L / 25 L','05 H','01 L','','','10 H / 21 L','06 H','23 L','21 H','','11 L'],
  1998:['05 H / 29 L','','','22 H','06 H','23 L','17 H','19 L','01 L / 25 H','20 L','11 H / 30 L','14 H / 17 L'],
  1999:['11 H','09 L','10 H','28 L','20 H / 28 L','','','','','14 H','02 L',''],
  2000:['','23 H','','06 L / 10 H','24 L','','13 H / 25 L','','13 H','19 L','','14 H / 26 L'],
  2001:['','16 H','13 L / 16 H','16 L','30 H','','','','21 L','','','06 H'],
  2002:['','27 H','','','','','','02 L','02 H','28 L','','26 H'],
  2003:['02 H','24 H','24 H','28 L','','','15 H / 22 L','','09 H / 19 L','17 H / 24 L','06 H / 21 L',''],
  2004:['09 H','','23 L','23 H','17 L / 26 H','24 L','','','','','',''],
  2005:['04 H / 12 L','','09 H','07 H / 29 L','','','','','','05 H / 28 L','',''],
  2006:['','','','','11 H','14 L','13 H / 24 L','','','','','08 H / 13 L'],
  2007:['','08 H','05 L','','','','24 H','17 L','','','',''],
  2008:['08 H / 22 L','04 H','18 L','02 H','16 L','','','12 H','','27 L','',''],
  2009:['','','06 L','','','12 H','13 L','','','20 H','03 L',''],
  2010:['06 H','08 L','','07 H','25 L','','','','','14 H / 29 L','08 H / 26 L','06 H / 10 L'],
  2011:['04 H','11 L','','06 H','','20 L','08 H','26 L','','28 H','','20 L'],
  2012:['02 L','22 H','','','','04 L','10 H / 26 L','23 H','06 L','05 H','19 L',''],
  2013:['29 H','','','10 L','20 H','24 L','23 H','28 L','19 H','01 L','03 H / 22 L','09 H'],
  2014:['','04 L','','','','','','','08 H','17 L','','04 H'],
  2015:['07 L / 30 H','','04 H','15 H','','12 L','','10 H','08 L','26 H','',''],
  2016:['','29 L','','','','','','','07 H','','','26 L'],
  2017:['','','','','','','','02 H / 11 L','19 H / 28 L','','06 H','06 L'],
  2018:['29 H','','23 L','','15 H / 23 L','','','28 H','','26 L','',''],
  2019:['29 L','','','','','03 H','','23 L','23 H','07 L','',''],
  2020:['20 H','','24 L','30 H','18 L','','','31 H','24 L','30 L','',''],
  2021:['29 L','16 H','','22 L','','','28 L','','','19 H','',''],
  2022:['18 H','','08 L','04 H','','17 L','','','14 H / 30 L','','',''],
  2023:['','16 H','20 L','','','','','','15 H','26 L','',''],
  2024:['24 L','','11 H / 20 L','10 H','','04 L','','','27 H','','21 L','05 H'],
  2025:['27 L','05 H','04 H / 25 L','07 L','','30 H','','08 L','','','',''],
}`;

const instrJS = JSON.stringify(INSTRUMENTS.map(({sym,name,isIndex}) => ({sym,name,isIndex:!!isIndex})));
const midcapInstrJS = JSON.stringify(MIDCAP_INSTRUMENTS.map(({sym,name}) => ({sym,name})));

// ── HTML ──────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Natural Cycle – NIFTY50</title>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<style>
  :root {
    --bg:#0d1117; --panel:#161b22; --border:#30363d;
    --accent:#58a6ff; --green:#3fb950; --red:#f85149; --orange:#e3b341;
    --text:#c9d1d9; --sub:#8b949e;
    --hbg:#0d2818; --lbg:#2d1010; --hlbg:#2d2010; --conf:#ffe066;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; font-size:13px; }

  /* ── App shell ── */
  .app-header { background:var(--panel); border-bottom:1px solid var(--border); padding:14px 24px 0; }
  .app-title { color:var(--accent); font-size:17px; font-weight:700; margin-bottom:12px; }
  .app-title span { color:var(--sub); font-weight:400; font-size:13px; margin-left:8px; }

  /* ── Tabs ── */
  .tab-nav { display:flex; gap:0; }
  .tab-btn { background:transparent; border:none; color:var(--sub); font-size:13px; font-family:inherit; padding:9px 22px; cursor:pointer; border-bottom:2px solid transparent; transition:color .15s,border-color .15s; white-space:nowrap; }
  .tab-btn:hover { color:var(--text); }
  .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); font-weight:600; }
  .tab-content { display:none; padding:24px; }
  .tab-content.active { display:block; }

  /* ── Shared controls ── */
  .ctrl-row { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:14px 20px; margin-bottom:20px; }
  .ctrl { display:flex; flex-direction:column; gap:5px; }
  .ctrl label { color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
  .ctrl input, .ctrl select { background:var(--bg); border:1px solid var(--accent); color:var(--accent); border-radius:6px; padding:6px 10px; font-size:14px; font-weight:700; outline:none; cursor:pointer; }
  .ctrl input  { width:90px; text-align:center; font-size:18px; }
  .ctrl select { min-width:160px; }
  .ctrl select option { background:var(--bg); }
  .zz-wrap { display:flex; gap:14px; }
  .zz-wrap.hidden { display:none; }

  .cycle-pills { display:flex; flex-wrap:wrap; gap:6px; align-self:center; }
  .pill { background:#1a2a3a; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 8px; font-size:11px; }
  .pill span { color:var(--accent); font-weight:700; }

  /* ── Shared badge styles ── */
  .ev { border-radius:3px; padding:2px 5px; font-size:11px; display:inline-block; margin:1px; white-space:nowrap; font-weight:600; cursor:default; }
  .ev-h  { background:var(--hbg);  color:var(--green);  border:1px solid #1a4a28; }
  .ev-l  { background:var(--lbg);  color:var(--red);    border:1px solid #4a1a1a; }
  .ev-hl { background:var(--hlbg); color:var(--orange); border:1px solid #4a3a1a; }

  /* ── Legend ── */
  .legend { display:flex; gap:18px; margin-bottom:14px; align-items:center; flex-wrap:wrap; }
  .leg { display:flex; align-items:center; gap:5px; font-size:11px; }
  .dot { width:10px; height:10px; border-radius:2px; }

  /* ══ TAB 1 — Natural Cycle ══ */
  .wrap { overflow-x:auto; }
  table.nc-table { border-collapse:collapse; width:100%; min-width:960px; }
  .nc-table thead th { background:#1c2128; color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:8px 6px; border:1px solid var(--border); text-align:center; position:sticky; top:0; z-index:3; }
  .nc-table thead th:first-child { text-align:left; padding-left:12px; min-width:120px; z-index:4; position:sticky; left:0; }
  .nc-table thead th:nth-child(2) { min-width:55px; }
  .nc-table tbody td { border:1px solid var(--border); padding:5px 6px; text-align:center; min-width:78px; vertical-align:top; }
  .nc-table tbody td:first-child { text-align:left; padding:6px 10px; background:#1a1f28; font-size:11px; position:sticky; left:0; z-index:1; min-width:120px; }
  .nc-table tbody td:nth-child(2) { color:var(--sub); font-size:11px; background:#161b22; text-align:center; }
  .nc-table tbody tr:hover td { background:#1a2130 !important; }
  .nc-table tbody tr:hover td:first-child { background:#1e2538 !important; }
  .yr-label { color:var(--accent); font-weight:700; font-size:13px; display:block; }
  .cycle-tag { color:var(--sub); font-size:10px; }
  .conf-row td { background:#1a1810 !important; }
  .conf-row td:first-child { background:#1a1810 !important; color:var(--conf); font-weight:700; }

  .conf-section { margin-top:24px; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:16px 20px; }
  .conf-section h3 { color:var(--conf); font-size:13px; margin-bottom:12px; }
  .conf-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:8px; }
  .conf-month-label { font-size:10px; font-weight:700; color:var(--sub); text-transform:uppercase; margin-bottom:6px; text-align:center; }
  .conf-item { text-align:center; border-radius:4px; padding:3px 4px; margin-bottom:3px; font-size:10px; font-weight:700; }
  .conf-h  { background:var(--hbg);  color:var(--green);  border:1px solid #1a4a28; }
  .conf-l  { background:var(--lbg);  color:var(--red);    border:1px solid #4a1a1a; }
  .conf-hl { background:var(--hlbg); color:var(--orange); border:1px solid #4a3a1a; }
  .conf-count { font-size:9px; opacity:.7; }

  /* ══ TAB 2 — Confluence Calendar ══ */
  .summary-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-left:auto; }
  .stat { background:#1a2a3a; border:1px solid var(--border); border-radius:5px; padding:4px 10px; font-size:11px; color:var(--sub); }
  .stat span { color:var(--accent); font-weight:700; }

  .filter-strip { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
  .filter-strip label { color:var(--sub); font-size:11px; }
  .fsep { width:1px; height:16px; background:var(--border); }
  .filter-btn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 10px; font-size:11px; cursor:pointer; }
  .filter-btn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }
  .view-toggle { display:flex; gap:6px; margin-left:auto; }
  .vtbtn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 12px; font-size:11px; cursor:pointer; }
  .vtbtn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }

  #dateView { display:flex; flex-direction:column; gap:12px; }
  .date-card { background:var(--panel); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .date-header { display:flex; align-items:center; gap:12px; padding:10px 16px; background:#1c2128; border-bottom:1px solid var(--border); }
  .date-num { font-size:28px; font-weight:700; color:var(--conf); line-height:1; min-width:42px; }
  .date-sublabel { color:var(--sub); font-size:12px; }
  .stock-count-badge { margin-left:auto; background:#3a3010; border:1px solid #6a5a10; color:var(--conf); border-radius:4px; padding:2px 8px; font-size:11px; font-weight:700; }
  .stock-count-badge.multi { background:#0d2818; border-color:#1a4a28; color:var(--green); }
  .stocks-grid { display:flex; flex-wrap:wrap; gap:8px; padding:12px 16px; }
  .stock-chip { border-radius:6px; padding:6px 10px; font-size:11px; border:1px solid; min-width:140px; }
  .chip-h  { background:var(--hbg);  border-color:#1a4a28; }
  .chip-l  { background:var(--lbg);  border-color:#4a1a1a; }
  .chip-hl { background:var(--hlbg); border-color:#4a3a1a; }
  .chip-sym  { font-weight:700; font-size:12px; margin-bottom:2px; }
  .chip-sym.h  { color:var(--green);  }
  .chip-sym.l  { color:var(--red);    }
  .chip-sym.hl { color:var(--orange); }
  .chip-name { color:var(--sub); font-size:10px; margin-bottom:4px; }
  .chip-meta .yr { color:var(--sub); margin-right:3px; font-size:10px; }
  .chip-count { float:right; font-weight:700; font-size:11px; }
  .chip-count.h  { color:var(--green);  }
  .chip-count.l  { color:var(--red);    }
  .chip-count.hl { color:var(--orange); }

  #stockView { display:none; }
  .stock-table { width:100%; border-collapse:collapse; }
  .stock-table th { background:#1c2128; color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:8px 12px; border:1px solid var(--border); text-align:left; position:sticky; top:0; }
  .stock-table td { border:1px solid var(--border); padding:8px 12px; vertical-align:top; }
  .stock-table td:first-child { font-weight:700; color:var(--accent); min-width:110px; }
  .stock-table td:nth-child(2) { color:var(--sub); font-size:11px; min-width:180px; }
  .stock-table tr:hover td { background:#1a2130; }
  .no-conf { color:#2a3040; font-style:italic; font-size:11px; }

  .empty-state { text-align:center; padding:60px 20px; color:var(--sub); font-size:13px; }

  /* ── Chart button ── */
  .chart-btn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:5px; padding:5px 11px; font-size:12px; cursor:pointer; white-space:nowrap; transition:color .15s,border-color .15s; }
  .chart-btn:hover { color:var(--accent); border-color:var(--accent); }
  .chip-chart-btn { background:transparent; border:none; color:var(--sub); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:3px; line-height:1; float:right; }
  .chip-chart-btn:hover { color:var(--accent); background:#1a2a3a; }

  /* ── Modal ── */
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); display:none; align-items:center; justify-content:center; z-index:1000; }
  .modal-overlay.open { display:flex; }
  .modal-box { background:var(--panel); border:1px solid var(--border); border-radius:10px; width:92vw; max-width:1200px; height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.6); }
  .modal-hdr { display:flex; align-items:center; gap:12px; padding:12px 18px; background:#1c2128; border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; }
  .modal-sym { font-size:16px; font-weight:700; color:var(--accent); }
  .modal-name { font-size:12px; color:var(--sub); }
  .modal-ctrls { display:flex; gap:10px; align-items:center; margin-left:auto; flex-wrap:wrap; }
  .modal-ctrls select { background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:5px; padding:4px 8px; font-size:12px; cursor:pointer; }
  .modal-range-btns { display:flex; gap:4px; }
  .range-btn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 9px; font-size:11px; cursor:pointer; }
  .range-btn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }
  .modal-close { background:transparent; border:none; color:var(--sub); font-size:18px; cursor:pointer; padding:2px 6px; border-radius:4px; margin-left:6px; }
  .modal-close:hover { color:var(--text); background:#30363d; }
  .modal-body { flex:1; min-height:0; position:relative; }
  #modal-chart-container { width:100%; height:100%; }
  .modal-pivots { flex-shrink:0; max-height:90px; overflow-y:auto; padding:8px 16px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; gap:4px; align-content:flex-start; }
  .modal-no-data { display:flex; align-items:center; justify-content:center; height:100%; color:var(--sub); font-size:14px; }
</style>
</head>
<body>

<!-- ══ Chart Modal ═══════════════════════════════════════════ -->
<div id="chart-modal" class="modal-overlay" onclick="if(event.target===this)closeChart()">
  <div class="modal-box">
    <div class="modal-hdr">
      <div>
        <div class="modal-sym" id="modal-sym">—</div>
        <div class="modal-name" id="modal-name">—</div>
      </div>
      <div class="modal-ctrls">
        <label style="color:var(--sub);font-size:11px">Dev%
          <select id="modal-dev" onchange="rerenderModalChart()">
            <option value="2">2%</option><option value="3">3%</option>
            <option value="4" selected>4%</option><option value="5">5%</option>
            <option value="7">7%</option><option value="10">10%</option><option value="15">15%</option>
          </select>
        </label>
        <label style="color:var(--sub);font-size:11px">Depth
          <select id="modal-dep" onchange="rerenderModalChart()">
            <option value="5">5</option><option value="8">8</option>
            <option value="10" selected>10</option><option value="12">12</option>
            <option value="15">15</option><option value="20">20</option>
          </select>
        </label>
        <div class="modal-range-btns" id="modal-range-btns">
          <button class="range-btn" onclick="setModalRange(1,this)">1Y</button>
          <button class="range-btn" onclick="setModalRange(3,this)">3Y</button>
          <button class="range-btn active" onclick="setModalRange(5,this)">5Y</button>
          <button class="range-btn" onclick="setModalRange(0,this)">All</button>
        </div>
      </div>
      <button class="modal-close" onclick="closeChart()" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body">
      <div id="modal-chart-container"></div>
    </div>
    <div class="modal-pivots" id="modal-pivots"></div>
  </div>
</div>

<div class="app-header">
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:12px;flex-wrap:wrap">
    <div class="app-title" style="margin-bottom:0">Gann Natural Cycle <span>NIFTY 50 + FNO</span></div>
    <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;font-size:12px;color:var(--sub)">
      <input type="checkbox" id="midcap-toggle" onchange="toggleMidcap()" style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer">
      <span style="color:var(--text)">Midcap / Smallcap Stocks</span>
      <span style="background:#1a2a3a;border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;color:var(--accent)">25 stocks</span>
    </label>
  </div>
  <nav class="tab-nav">
    <button class="tab-btn active" onclick="switchTab('nc',this)">Natural Cycle</button>
    <button class="tab-btn" onclick="switchTab('conf',this)">Confluence Calendar</button>
  </nav>
</div>

<!-- ══ TAB 1: Natural Cycle ══════════════════════════════════ -->
<div id="tab-nc" class="tab-content active">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Instrument</label>
      <select id="nc-instr" onchange="ncOnInstrChange()">
        <optgroup label="NIFTY 50">
        ${instrOptionsNifty}
        </optgroup>
        <optgroup id="nc-mc-optgroup" label="Midcap / Smallcap" style="display:none">
        ${instrOptionsMidcap}
        </optgroup>
      </select>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <input type="number" id="nc-year" value="2026" min="2000" max="2050" oninput="ncRender()">
    </div>
    <div class="zz-wrap hidden" id="nc-zz">
      <div class="ctrl">
        <label>ZigZag Deviation %</label>
        <select id="nc-dev" onchange="invalidateCache(); ncRender()">
          <option value="2">2%</option><option value="3">3%</option>
          <option value="4" selected>4%</option><option value="5">5%</option>
          <option value="7">7%</option><option value="10">10%</option><option value="15">15%</option>
        </select>
      </div>
      <div class="ctrl">
        <label>Min Bars (Depth)</label>
        <select id="nc-dep" onchange="invalidateCache(); ncRender()">
          <option value="5">5</option><option value="8">8</option>
          <option value="10" selected>10</option><option value="12">12</option>
          <option value="15">15</option><option value="20">20</option>
        </select>
      </div>
    </div>
    <div class="cycle-pills" id="nc-pills"></div>
    <button class="chart-btn" id="nc-chart-btn" onclick="openChartFromNC()" style="margin-left:auto" title="Open ZigZag chart for selected instrument">📈 Chart</button>
  </div>

  <div class="legend">
    <div class="leg"><div class="dot" style="background:var(--green)"></div> High (H)</div>
    <div class="leg"><div class="dot" style="background:var(--red)"></div> Low (L)</div>
    <div class="leg"><div class="dot" style="background:var(--orange)"></div> High + Low same date</div>
    <div class="leg"><div class="dot" style="background:var(--conf)"></div> Confluence (≥2 years)</div>
  </div>

  <div class="wrap">
    <table class="nc-table">
      <thead><tr>
        <th>Year (Cycle)</th><th>Gap</th>
        <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
        <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
      </tr></thead>
      <tbody id="nc-tbody"></tbody>
    </table>
  </div>

  <div class="conf-section">
    <h3>⚡ Confluence Map — Dates appearing in ≥2 Gann cycle years</h3>
    <div class="conf-grid" id="nc-conf-grid"></div>
  </div>
</div>

<!-- ══ TAB 2: Confluence Calendar ════════════════════════════ -->
<div id="tab-conf" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Month</label>
      <select id="cf-month" onchange="cfRender()">${monthOptions}</select>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <select id="cf-year" onchange="cfRender()">${yearOptions}</select>
    </div>
    <div class="ctrl">
      <label>ZigZag Deviation %</label>
      <select id="cf-dev" onchange="invalidateCache(); cfRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Min Bars (Depth)</label>
      <select id="cf-dep" onchange="invalidateCache(); cfRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <div class="summary-bar">
      <div class="stat">Dates with signal <span id="cf-stat-dates">—</span></div>
      <div class="stat">Stocks hit <span id="cf-stat-stocks">—</span></div>
      <div class="stat">Multi-stock dates <span id="cf-stat-multi">—</span></div>
    </div>
  </div>

  <div class="filter-strip">
    <label>Min stocks per date:</label>
    <button class="filter-btn active" onclick="cfSetMin(1,this)">Any (≥1)</button>
    <button class="filter-btn" onclick="cfSetMin(2,this)">≥2 stocks</button>
    <button class="filter-btn" onclick="cfSetMin(3,this)">≥3 stocks</button>
    <button class="filter-btn" onclick="cfSetMin(4,this)">≥4 stocks</button>
    <div class="fsep"></div>
    <div class="view-toggle">
      <button class="vtbtn active" onclick="cfSetView('date',this)">By Date</button>
      <button class="vtbtn" onclick="cfSetView('stock',this)">By Stock</button>
    </div>
  </div>

  <div id="dateView"></div>
  <div id="stockView">
    <table class="stock-table">
      <thead><tr><th>Stock</th><th>Instrument</th><th>Confluence Dates</th><th>Lookback Years</th></tr></thead>
      <tbody id="cf-stock-tbody"></tbody>
    </table>
  </div>
</div>

<script>
// ════════════════════════════════════════════════════════
// SHARED DATA & ENGINE
// ════════════════════════════════════════════════════════
const INSTRUMENTS = ${instrJS};
const MIDCAP_INSTRUMENTS = ${midcapInstrJS};
const NIFTY_F = ${NIFTY_F_JS};
const OHLC_DATA = {
${ohlcDataJS}
};

const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const GAPS        = [20,15,13,12,10,6,5,4,3,2,1];

// ── ZigZag engine ─────────────────────────────────────
function computeZigZag(rows, dev, dep) {
  const pivots = [];
  if (!rows || !rows.length) return pivots;
  // format: [date, open, high, low, close] — high=idx2, low=idx3
  let trend=null, lhP=rows[0][2], lhD=rows[0][0], lhI=0, llP=rows[0][3], llD=rows[0][0], llI=0;
  for (let i=1;i<rows.length;i++) {
    const date=rows[i][0], high=rows[i][2], low=rows[i][3];
    if (trend===null||trend==='UP') {
      if (high>=lhP){lhP=high;lhD=date;lhI=i;}
      if (low<=lhP*(1-dev/100)&&(i-lhI)>=dep){
        pivots.push({date:lhD,type:'H',price:lhP});
        trend='DOWN';
        // Look back from lhI+1 to i to find the actual minimum low
        llP=low; llD=date; llI=i;
        for (let j=lhI+1;j<=i;j++){if(rows[j][3]<llP){llP=rows[j][3];llD=rows[j][0];llI=j;}}
      }
    }
    if (trend==='DOWN') {
      if (low<=llP){llP=low;llD=date;llI=i;}
      if (high>=llP*(1+dev/100)&&(i-llI)>=dep){
        pivots.push({date:llD,type:'L',price:llP});
        trend='UP';
        // Look back from llI+1 to i to find the actual maximum high
        lhP=high; lhD=date; lhI=i;
        for (let j=llI+1;j<=i;j++){if(rows[j][2]>lhP){lhP=rows[j][2];lhD=rows[j][0];lhI=j;}}
      }
    }
  }
  if (trend==='UP') pivots.push({date:lhD,type:'H',price:lhP});
  else if (trend==='DOWN') pivots.push({date:llD,type:'L',price:llP});
  return pivots;
}

let _cache = null;
function invalidateCache() { _cache = null; }

function getZZMatrix(sym, dev, dep) {
  if (!_cache) _cache = {};
  const key = sym+'|'+dev+'|'+dep;
  if (_cache[key]) return _cache[key];
  const pivots = computeZigZag(OHLC_DATA[sym], dev, dep);
  const matrix = {};
  pivots.forEach(({date,type}) => {
    const yr = parseInt(date.substring(0,4));
    const mi = parseInt(date.substring(5,7))-1;
    const dd = date.substring(8,10);
    if (!matrix[yr]) matrix[yr] = Array.from({length:12},()=>[]);
    matrix[yr][mi].push({day:dd,type});
  });
  _cache[key] = matrix;
  return matrix;
}

function getYearRow(sym, year, dev, dep) {
  if (sym==='NIFTY') return NIFTY_F[year] || Array(12).fill('');
  const m = getZZMatrix(sym, dev, dep);
  const yd = m[year];
  if (!yd) return Array(12).fill('');
  return yd.map(entries => {
    if (!entries||!entries.length) return '';
    return entries.sort((a,b)=>+a.day-+b.day).map(e=>e.day+' '+e.type).join(' / ');
  });
}

function extractDates(val) {
  const r=[];
  val.split(/\\s*\\/\\s*/).forEach(p=>{
    const m=p.trim().match(/^(\\d{1,2})\\s*([HL])/i);
    if (m) r.push({day:m[1].padStart(2,'0'),type:m[2].toUpperCase()});
  });
  return r;
}

function classify(val) {
  if (!val) return 'empty';
  const h=/H/i.test(val), l=/L/i.test(val);
  return (h&&l)?'hl':h?'h':l?'l':'empty';
}

function cellHTML(val) {
  if (!val) return '';
  return val.split(/\\s*\\/\\s*/).map(p=>{
    p=p.trim();
    const t=classify(p);
    const cls=t==='h'?'ev-h':t==='l'?'ev-l':t==='hl'?'ev-hl':'';
    return cls?\`<span class="ev \${cls}">\${p}</span>\`:\`<span>\${p}</span>\`;
  }).join('<br>');
}

// ════════════════════════════════════════════════════════
// CHART MODAL
// ════════════════════════════════════════════════════════
let _modalChart = null;
let _modalSym   = null;
let _modalRange = 5;

function openChart(sym, name, dev, dep) {
  if (sym === 'NIFTY') return;
  _modalSym = sym;
  document.getElementById('modal-sym').textContent  = sym;
  document.getElementById('modal-name').textContent = name;
  document.getElementById('modal-dev').value = dev;
  document.getElementById('modal-dep').value = dep;
  document.getElementById('chart-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderModalChart();
}

function openChartFromNC() {
  const sym = document.getElementById('nc-instr').value;
  const dev = parseFloat(document.getElementById('nc-dev').value);
  const dep = parseInt(document.getElementById('nc-dep').value);
  const instr = [...INSTRUMENTS, ...MIDCAP_INSTRUMENTS].find(i => i.sym === sym);
  if (!instr || sym === 'NIFTY') { alert('No chart data for ' + sym); return; }
  openChart(sym, instr.name, dev, dep);
}

function closeChart() {
  document.getElementById('chart-modal').classList.remove('open');
  document.body.style.overflow = '';
  if (_modalChart) { _modalChart.remove(); _modalChart = null; }
}

function rerenderModalChart() { renderModalChart(); }

function setModalRange(years, btn) {
  _modalRange = years;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyModalRange();
}

function applyModalRange() {
  if (!_modalChart) return;
  if (_modalRange === 0) { _modalChart.timeScale().fitContent(); return; }
  const now = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - _modalRange);
  _modalChart.timeScale().setVisibleRange({
    from: from.toISOString().substring(0,10),
    to:   now.toISOString().substring(0,10),
  });
}

function renderModalChart() {
  const sym = _modalSym;
  const dev = parseFloat(document.getElementById('modal-dev').value);
  const dep = parseInt(document.getElementById('modal-dep').value);
  const container = document.getElementById('modal-chart-container');

  if (_modalChart) { _modalChart.remove(); _modalChart = null; }

  const rows = OHLC_DATA[sym];
  if (!rows || !rows.length) {
    container.innerHTML = \`<div class="modal-no-data">No data available for \${sym}</div>\`;
    return;
  }

  _modalChart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight,
    layout: { background:{type:'solid',color:'#0d1117'}, textColor:'#c9d1d9' },
    grid:   { vertLines:{color:'#21262d'}, horzLines:{color:'#21262d'} },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor:'#30363d', scaleMargins:{top:.08,bottom:.08} },
    timeScale: { borderColor:'#30363d', timeVisible:false },
  });

  // Candlestick series
  const candleSeries = _modalChart.addCandlestickSeries({
    upColor:'#3fb950', downColor:'#f85149',
    borderUpColor:'#3fb950', borderDownColor:'#f85149',
    wickUpColor:'#3fb950', wickDownColor:'#f85149',
  });
  candleSeries.setData(rows.map(r => ({
    time:r[0], open:r[1], high:r[2], low:r[3], close:r[4],
  })));

  // ZigZag overlay line
  const pivots = computeZigZag(rows, dev, dep);
  const zzLine = _modalChart.addLineSeries({
    color:'#e3b341', lineWidth:2, crosshairMarkerVisible:false,
    lastValueVisible:false, priceLineVisible:false,
  });
  zzLine.setData(pivots.map(p => ({ time:p.date, value:p.price })));

  // H/L markers on candle series
  candleSeries.setMarkers(pivots.map(p => ({
    time:  p.date,
    position: p.type==='H' ? 'aboveBar' : 'belowBar',
    color:    p.type==='H' ? '#3fb950'  : '#f85149',
    shape:    p.type==='H' ? 'arrowDown' : 'arrowUp',
    text:     p.type==='H' ? \`H \${p.price.toFixed(0)}\` : \`L \${p.price.toFixed(0)}\`,
    size: 0.7,
  })));

  applyModalRange();

  // Pivot strip
  const strip = document.getElementById('modal-pivots');
  const recent = [...pivots].reverse().slice(0, 40);
  strip.innerHTML = recent.map(p => {
    const cls = p.type==='H' ? 'ev-h' : 'ev-l';
    return \`<span class="ev \${cls}">\${p.date.substring(0,7)} \${p.type} \${p.price.toFixed(0)}</span>\`;
  }).join('');

  // Resize observer
  const ro = new ResizeObserver(() => {
    if (_modalChart) _modalChart.applyOptions({ width:container.clientWidth, height:container.clientHeight });
  });
  ro.observe(container);
}

document.addEventListener('keydown', e => { if (e.key==='Escape') closeChart(); });

// ── Midcap toggle ──────────────────────────────────────
function getActiveInstruments() {
  const show = document.getElementById('midcap-toggle').checked;
  return show ? [...INSTRUMENTS, ...MIDCAP_INSTRUMENTS] : INSTRUMENTS;
}

function toggleMidcap() {
  const show = document.getElementById('midcap-toggle').checked;
  const grp = document.getElementById('nc-mc-optgroup');
  if (show) {
    grp.style.display = '';
  } else {
    grp.style.display = 'none';
    const sel = document.getElementById('nc-instr');
    const isMidcap = MIDCAP_INSTRUMENTS.some(i => i.sym === sel.value);
    if (isMidcap) { sel.value = 'NIFTY'; ncOnInstrChange(); }
  }
  if (_activeTab === 'conf') cfRender();
}

// ── Tab switching ──────────────────────────────────────
let _activeTab = 'nc';
function switchTab(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
  _activeTab = id;
  if (id==='nc') ncRender();
  else cfRender();
}

// ════════════════════════════════════════════════════════
// TAB 1 — Natural Cycle
// ════════════════════════════════════════════════════════
function ncOnInstrChange() {
  const sym = document.getElementById('nc-instr').value;
  document.getElementById('nc-zz').classList.toggle('hidden', sym==='NIFTY');
  invalidateCache();
  ncRender();
}

function ncRender() {
  const yr  = parseInt(document.getElementById('nc-year').value);
  if (!yr||yr<2000||yr>2100) return;
  const sym = document.getElementById('nc-instr').value;
  const dev = parseFloat(document.getElementById('nc-dev').value);
  const dep = parseInt(document.getElementById('nc-dep').value);
  const years = GAPS.map(g=>({gap:g,year:yr-g}));

  document.getElementById('nc-pills').innerHTML = years.map(({gap,year})=>
    \`<div class="pill">\${year} <span>(−\${gap}yr)</span></div>\`).join('');

  const freq = MONTHS.map(()=>({}));
  years.forEach(({year})=>{
    getYearRow(sym,year,dev,dep).forEach((val,mi)=>{
      if (!val) return;
      extractDates(val).forEach(({day,type})=>{
        if (!freq[mi][day]) freq[mi][day]=[];
        freq[mi][day].push({year,type});
      });
    });
  });

  const tbody = document.getElementById('nc-tbody');
  tbody.innerHTML='';
  years.forEach(({gap,year})=>{
    const row=getYearRow(sym,year,dev,dep);
    const tr=document.createElement('tr');
    tr.innerHTML=\`<td><span class="yr-label">\${year}</span><span class="cycle-tag">−\${gap} yr</span></td><td>\${gap}yr</td>\`;
    row.forEach(val=>{tr.innerHTML+=\`<td>\${cellHTML(val)}</td>\`;});
    tbody.appendChild(tr);
  });

  const confTr=document.createElement('tr');
  confTr.className='conf-row';
  confTr.innerHTML=\`<td>⚡ Confluence<br><span style="font-size:10px;color:var(--sub)">≥2 years</span></td><td>—</td>\`;
  MONTHS.forEach((_,mi)=>{
    const cd=Object.entries(freq[mi]).filter(([,a])=>a.length>=2).sort((a,b)=>b[1].length-a[1].length);
    if (!cd.length){confTr.innerHTML+='<td></td>';return;}
    confTr.innerHTML+=\`<td>\${cd.map(([day,arr])=>{
      const hh=arr.some(e=>e.type==='H'),ll=arr.some(e=>e.type==='L');
      const cls=(hh&&ll)?'ev-hl':hh?'ev-h':'ev-l';
      const lbl=(hh&&ll)?\`\${day} H/L\`:hh?\`\${day} H\`:\`\${day} L\`;
      const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
      return\`<span class="ev \${cls}" title="\${tip}">⚡\${lbl} ×\${arr.length}</span>\`;
    }).join('<br>')}</td>\`;
  });
  tbody.appendChild(confTr);

  const grid=document.getElementById('nc-conf-grid');
  grid.innerHTML='';
  MONTHS.forEach((m,mi)=>{
    const cd=Object.entries(freq[mi]).filter(([,a])=>a.length>=2).sort((a,b)=>b[1].length-a[1].length);
    const div=document.createElement('div');
    div.innerHTML=\`<div class="conf-month-label">\${m}</div>\`+(
      !cd.length?\`<div style="color:var(--sub);font-size:10px;text-align:center">—</div>\`
      :cd.map(([day,arr])=>{
          const hh=arr.some(e=>e.type==='H'),ll=arr.some(e=>e.type==='L');
          const cls=(hh&&ll)?'conf-hl':hh?'conf-h':'conf-l';
          const lbl=(hh&&ll)?\`\${day} H/L\`:hh?\`\${day} H\`:\`\${day} L\`;
          const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
          return\`<div class="conf-item \${cls}" title="\${tip}">\${lbl} <span class="conf-count">×\${arr.length}</span></div>\`;
        }).join('')
    );
    grid.appendChild(div);
  });
}

// ════════════════════════════════════════════════════════
// TAB 2 — Confluence Calendar
// ════════════════════════════════════════════════════════
let _cfMin  = 1;
let _cfView = 'date';

function cfGetConfluence(sym, analysisYear, monthIdx, dev, dep) {
  const lookbackYears = GAPS.map(g=>analysisYear-g);
  const freq={};
  if (sym==='NIFTY') {
    lookbackYears.forEach(yr=>{
      const row=NIFTY_F[yr]; if (!row||!row[monthIdx]) return;
      row[monthIdx].split(/\\s*\\/\\s*/).forEach(p=>{
        const m=p.trim().match(/^(\\d{1,2})\\s*([HL])/i);
        if (!m) return;
        const day=m[1].padStart(2,'0'), type=m[2].toUpperCase();
        if (!freq[day]) freq[day]=[];
        freq[day].push({year:yr,type});
      });
    });
  } else {
    const matrix=getZZMatrix(sym,dev,dep);
    lookbackYears.forEach(yr=>{
      const yd=matrix[yr]; if (!yd||!yd[monthIdx]) return;
      yd[monthIdx].forEach(({day,type})=>{
        if (!freq[day]) freq[day]=[];
        freq[day].push({year:yr,type});
      });
    });
  }
  const result={};
  for (const [day,arr] of Object.entries(freq)) { if (arr.length>=2) result[day]=arr; }
  return result;
}

function cfChipCls(arr) {
  const h=arr.some(e=>e.type==='H'), l=arr.some(e=>e.type==='L');
  return (h&&l)?'hl':h?'h':'l';
}

function cfRender() {
  const monthIdx = parseInt(document.getElementById('cf-month').value);
  const year     = parseInt(document.getElementById('cf-year').value);
  const dev      = parseFloat(document.getElementById('cf-dev').value);
  const dep      = parseInt(document.getElementById('cf-dep').value);

  const dateMap={}, stockConf={};
  const stocksWithSignal=new Set();

  getActiveInstruments().forEach(({sym,name})=>{
    const conf=cfGetConfluence(sym,year,monthIdx,dev,dep);
    if (!Object.keys(conf).length) return;
    stockConf[sym]={name,conf};
    stocksWithSignal.add(sym);
    for (const [day,arr] of Object.entries(conf)) {
      if (!dateMap[day]) dateMap[day]=[];
      dateMap[day].push({sym,name,arr});
    }
  });

  const sortedDays=Object.keys(dateMap).sort();
  const multiDays=sortedDays.filter(d=>dateMap[d].length>=2);

  document.getElementById('cf-stat-dates').textContent  = sortedDays.length;
  document.getElementById('cf-stat-stocks').textContent = stocksWithSignal.size;
  document.getElementById('cf-stat-multi').textContent  = multiDays.length;

  const filtered = sortedDays.filter(d=>dateMap[d].length>=_cfMin);

  if (_cfView==='date') cfRenderDate(filtered, dateMap, monthIdx, year, dev, dep);
  else cfRenderStock(stockConf, monthIdx, year);
}

function cfRenderDate(days, dateMap, monthIdx, year, dev, dep) {
  const el=document.getElementById('dateView');
  const monthName=MONTHS_LONG[monthIdx];
  if (!days.length) {
    el.innerHTML=\`<div class="empty-state">No confluence dates for <strong>\${monthName} \${year}</strong> with current filters.</div>\`;
    return;
  }
  el.innerHTML=days.map(day=>{
    const stocks=dateMap[day];
    const isMulti=stocks.length>=2;
    const chips=stocks.sort((a,b)=>b.arr.length-a.arr.length).map(({sym,name,arr})=>{
      const cls=cfChipCls(arr);
      const yrs=arr.map(e=>\`<span class="yr">\${e.year}:\${e.type}</span>\`).join('');
      const chartBtn=sym!=='NIFTY'?\`<button class="chip-chart-btn" onclick="openChart('\${sym}','\${name.replace(/'/g,"\\\\'")}',\${dev},\${dep})" title="Open chart">📈</button>\`:'';
      return\`<div class="stock-chip chip-\${cls}">
        <div style="display:flex;align-items:center;justify-content:space-between">\${chartBtn}<div class="chip-sym \${cls}" style="flex:1">\${sym} <span class="chip-count \${cls}">×\${arr.length}</span></div></div>
        <div class="chip-name">\${name}</div>
        <div class="chip-meta">\${yrs}</div>
      </div>\`;
    }).join('');
    return\`<div class="date-card">
      <div class="date-header">
        <div class="date-num">\${day}</div>
        <div>
          <div style="color:var(--conf);font-weight:700">\${day} \${monthName} \${year}</div>
          <div class="date-sublabel">\${stocks.length} stock\${stocks.length>1?'s':''} with Gann confluence</div>
        </div>
        <div class="stock-count-badge \${isMulti?'multi':''}">\${stocks.length} stock\${stocks.length>1?'s':''}</div>
      </div>
      <div class="stocks-grid">\${chips}</div>
    </div>\`;
  }).join('');
}

function cfRenderStock(stockConf, monthIdx, year) {
  const tbody=document.getElementById('cf-stock-tbody');
  const monthName=MONTHS_LONG[monthIdx];
  if (!Object.keys(stockConf).length) {
    tbody.innerHTML=\`<tr><td colspan="4" class="empty-state">No confluence dates for \${monthName} \${year}.</td></tr>\`;
    return;
  }
  tbody.innerHTML=getActiveInstruments().map(({sym,name})=>{
    const sc=stockConf[sym];
    if (!sc) {
      if (_cfMin>1) return '';
      return\`<tr><td>\${sym}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td colspan="2" class="no-conf">—</td></tr>\`;
    }
    const days=Object.keys(sc.conf).sort();
    const badges=days.map(day=>{
      const arr=sc.conf[day];
      const h=arr.some(e=>e.type==='H'), l=arr.some(e=>e.type==='L');
      const cls=(h&&l)?'ev-hl':h?'ev-h':'ev-l';
      const lbl=day+' '+((h&&l)?'H/L':h?'H':'L');
      const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
      return\`<span class="ev \${cls}" title="\${tip}">⚡ \${lbl} ×\${arr.length}</span>\`;
    }).join(' ');
    const yrs=[...new Set(days.flatMap(d=>sc.conf[d].map(e=>e.year)))].sort().join(', ');
    return\`<tr><td>\${sym}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td>\${badges}</td><td style="color:var(--sub);font-size:11px">\${yrs}</td></tr>\`;
  }).filter(Boolean).join('');
}

function cfSetMin(n,btn) {
  _cfMin=n;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  cfRender();
}
function cfSetView(v,btn) {
  _cfView=v;
  document.querySelectorAll('.vtbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dateView').style.display  = v==='date'?'flex':'none';
  document.getElementById('stockView').style.display = v==='stock'?'block':'none';
  cfRender();
}

// ── Init ───────────────────────────────────────────────
ncRender();
</script>
</body>
</html>`;

fs.writeFileSync('j:/GANN Claude/Gann/6/trial_natural_cycle.html', html, 'utf8');
const size = (fs.statSync('j:/GANN Claude/Gann/6/trial_natural_cycle.html').size/1024/1024).toFixed(1);
console.error(`Done. trial_natural_cycle.html — ${size} MB`);
