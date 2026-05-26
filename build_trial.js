// Builds Gann/6/trial_natural_cycle.html
// Two tabs: Natural Cycle + Confluence Calendar
// Shared: NIFTY_F, OHLC_DATA, ZigZag engine, cache
// node build_trial.js

const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

// ── Parquet reader (via Python temp script) ──────────────────
const PARQUET_DIR = 'J:/Winning Characteristics/Final Data';
const TMP_PY = path.join(require('os').tmpdir(), '_gann_parquet_reader.py');

function readParquet(sym) {
  const fpath = path.join(PARQUET_DIR, `${sym}.parquet`).replace(/\\/g, '/');
  const script = [
    'import pandas as pd, json',
    `df = pd.read_parquet(r'${fpath}')`,
    `df = df[df['volume'] > 0]`,
    `df = df[df['date'] >= '2000-01-01']`,
    `df = df.sort_values('date')`,
    `rows = df[['date','open','high','low','close']].values.tolist()`,
    `print(json.dumps([[str(r[0]),round(float(r[1]),2),round(float(r[2]),2),round(float(r[3]),2),round(float(r[4]),2)] for r in rows]))`,
  ].join('\n');
  fs.writeFileSync(TMP_PY, script, 'utf8');
  try {
    const out = execSync(`py -3 "${TMP_PY}"`, { maxBuffer: 50 * 1024 * 1024 });
    return JSON.parse(out.toString());
  } catch (e) {
    console.error(`  WARNING: could not read parquet for ${sym}: ${e.message.slice(0,100)}`);
    return [];
  }
}

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

// ── Swing HIGH RS symbols (Blue list + Execution, NSE only, flat) ────────────
const SRS_INSTRUMENTS = [
  // ── Blue list ────────────────────────────────────────────────
  { sym:'AADHARHFC',  name:'Aadhar Housing Finance'     },
  { sym:'AETHER',     name:'Aether Industries'           },
  { sym:'AEROFLEX',   name:'Aeroflex Industries'         },
  { sym:'ADANIENSOL', name:'Adani Energy Solutions'      },
  { sym:'ADANIPOWER', name:'Adani Power'                 },
  { sym:'AIMTRON',    name:'Aimtron Electronics'         },
  { sym:'APLAPOLLO',  name:'APL Apollo Tubes'            },
  { sym:'APOLLO',     name:'Apollo Micro Systems'        },
  { sym:'ARIES',      name:'Aries Agro'                  },
  { sym:'ARSSBL',     name:'ARS Steels & Alloy Intl'    },
  { sym:'ARVIND',     name:'Arvind Ltd'                  },
  { sym:'ASKAUTOLTD', name:'ASK Automotive'              },
  { sym:'ASTERDM',    name:'Aster DM Healthcare'         },
  { sym:'ATALREAL',   name:'Atal Realtech'               },
  { sym:'ATGL',       name:'Adani Total Gas'             },
  { sym:'BANCOINDIA', name:'Banco Products'              },
  { sym:'BBOX',       name:'Black Box Ltd'               },
  { sym:'BELRISE',    name:'Belrise Industries'          },
  { sym:'BLACKBUCK',  name:'Zinka Logistics (BlackBuck)' },
  { sym:'CANHLIFE',   name:'Canara HSBC Life Insurance'  },
  { sym:'CARRARO',    name:'Carraro India'               },
  { sym:'CCL',        name:'CCL Products'                },
  { sym:'CENTUM',     name:'Centum Electronics'          },
  { sym:'CPPLUS',     name:'CP Plus (Aditya Infotech)'   },
  { sym:'CUMMINSIND', name:'Cummins India'               },
  { sym:'CUPID',      name:'Cupid Ltd'                   },
  { sym:'DREDGECORP', name:'Dredging Corporation'        },
  { sym:'DSSL',       name:'Dynacons Systems'            },
  { sym:'DYNAMATECH', name:'Dynamatic Technologies'      },
  { sym:'EMCURE',     name:'Emcure Pharmaceuticals'      },
  { sym:'ENDURANCE',  name:'Endurance Technologies'      },
  { sym:'ESABINDIA',  name:'Esab India'                  },
  { sym:'FEDERALBNK', name:'Federal Bank'                },
  { sym:'FIEMIND',    name:'Fiem Industries'             },
  { sym:'FRACTAL',    name:'Fractal Analytics'           },
  { sym:'GENUSPOWER', name:'Genus Power'                 },
  { sym:'GICRE',      name:'GIC Re'                      },
  { sym:'GLAND',      name:'Gland Pharma'                },
  { sym:'GLENMARK',   name:'Glenmark Pharma'             },
  { sym:'GMBREW',     name:'GM Breweries'                },
  { sym:'GODAVARIB',  name:'Godavari Biorefineries'      },
  { sym:'GOKULAGRO',  name:'Gokul Agro Resources'        },
  { sym:'GRASIM',     name:'Grasim Industries'           },
  { sym:'GRMOVER',    name:'GRM Overseas'                },
  { sym:'GUJALKALI',  name:'Gujarat Alkalies'            },
  { sym:'HEG',        name:'HEG Ltd'                     },
  { sym:'HIRECT',     name:'Hi-Tech Pipes'               },
  { sym:'IMFA',       name:'Indian Metals & Ferro Alloys'},
  { sym:'INDIAGLYCO', name:'India Glycols'               },
  { sym:'IPCALAB',    name:'Ipca Laboratories'           },
  { sym:'JAMNAAUTO',  name:'Jamna Auto Industries'       },
  { sym:'JSLL',       name:'Jain Irrigation Systems'     },
  { sym:'KERNEX',     name:'Kernex Microsystems'         },
  { sym:'KIRLPNU',    name:'Kirloskar Pneumatic'         },
  { sym:'KPIGREEN',   name:'KPI Green Energy'            },
  { sym:'KTKBANK',    name:'Karnataka Bank'              },
  { sym:'KRN',        name:'KRN Heat Exchanger'          },
  { sym:'LINDEINDIA', name:'Linde India'                 },
  { sym:'LLOYDSME',   name:'Lloyds Metals & Energy'      },
  { sym:'MANINDS',    name:'Man Industries'              },
  { sym:'MANORAMA',   name:'Manorama Industries'         },
  { sym:'MAYURUNIQ',  name:'Mayur Uniquoters'            },
  { sym:'MBAPL',      name:'Meghmani Organics'           },
  { sym:'NGLFINE',    name:'NGL Fine-Chem'               },
  { sym:'OLECTRA',    name:'Olectra Greentech'           },
  { sym:'ONESOURCE',  name:'OneSource Specialty Pharma'  },
  { sym:'PFOCUS',     name:'Prime Focus'                 },
  { sym:'POWERINDIA', name:'Hitachi Energy India'        },
  { sym:'PRECWIRE',   name:'Precision Wires'             },
  { sym:'PRIVISCL',   name:'Privi Speciality Chemicals'  },
  { sym:'PSPPROJECT', name:'PSP Projects'                },
  { sym:'ROSSTECH',   name:'Ross Tech'                   },
  { sym:'SAILIFE',    name:'SAI Life Sciences'           },
  { sym:'SANDUMA',    name:'Sandur Manganese'            },
  { sym:'SCHNEIDER',  name:'Schneider Electric Infra'    },
  { sym:'SENORES',    name:'Senores Pharmaceuticals'     },
  { sym:'SHAILY',     name:'Shaily Engineering Plastics' },
  { sym:'SHARDACROP', name:'Sharda Cropchem'             },
  { sym:'SHILCTECH',  name:'Shilchar Technologies'       },
  { sym:'SMSPHARMA',  name:'SMS Pharmaceuticals'         },
  { sym:'SOUTHWEST',  name:'South West Pinnacle Exp'     },
  { sym:'STAR',       name:'Star Health Insurance'       },
  { sym:'STARHEALTH', name:'Star Health Insurance'       },
  { sym:'SUZLON',     name:'Suzlon Energy'               },
  { sym:'TDPOWERSYS', name:'TD Power Systems'            },
  { sym:'TECHNOE',    name:'Techno Electric & Engg'      },
  { sym:'THERMAX',    name:'Thermax'                     },
  { sym:'THYROCARE',  name:'Thyrocare Technologies'      },
  { sym:'TI',         name:'Tube Investments of India'   },
  { sym:'TUNWAL',     name:'Tunwal E-Motors'             },
  { sym:'TVSHLTD',    name:'TVS Holdings'                },
  { sym:'UJJIVANSFB', name:'Ujjivan Small Finance Bank'  },
  { sym:'UTLSOLAR',   name:'UTL Solar'                   },
  { sym:'VIDYAWIRES', name:'Vidya Wires'                 },
  { sym:'VIVIANA',    name:'Viviana Power Tech'          },
  { sym:'VTL',        name:'Vardhman Textiles'           },
  { sym:'WAAREEENER', name:'Waaree Energies'             },
  { sym:'WOCKPHARMA', name:'Wockhardt'                   },
  { sym:'YATHARTH',   name:'Yatharth Hospital'           },
  { sym:'ZFCVINDIA',  name:'ZF Commercial Vehicle'       },
  { sym:'ZYDUSWELL',  name:'Zydus Wellness'              },
  // ── Execution list ───────────────────────────────────────────
  { sym:'ABSLAMC',    name:'Aditya Birla Sun Life AMC'   },
  { sym:'ADANIENT',   name:'Adani Enterprises'           },
  { sym:'ANGELONE',   name:'Angel One'                   },
  { sym:'ANURAS',     name:'Anuras Tech'                 },
  { sym:'ASTRAMICRO', name:'Astra Microwave Products'    },
  { sym:'ATLANTAELE', name:'Atlanta Electronics'         },
  { sym:'ATHERENERG', name:'Athar Energy'                },
  { sym:'AVALON',     name:'Avalon Technologies'         },
  { sym:'AYE',        name:'Aye Finance'                 },
  { sym:'AXISCADES',  name:'Axiscades Technologies'      },
  { sym:'AZAD',       name:'Azad Engineering'            },
  { sym:'BAJAJCON',   name:'Bajaj Consumer Care'         },
  { sym:'BHEL',       name:'Bharat Heavy Electricals'    },
  { sym:'BLISSGVS',   name:'Bliss GVS Pharma'           },
  { sym:'BSE',        name:'BSE Ltd'                     },
  { sym:'CARERATING', name:'CARE Ratings'                },
  { sym:'CARYSIL',    name:'Carysil'                     },
  { sym:'CEMPRO',     name:'Cement Products'             },
  { sym:'CHENNPETRO', name:'Chennai Petroleum'           },
  { sym:'DATAPATTNS', name:'Data Patterns'               },
  { sym:'DEEPAKFERT', name:'Deepak Fertilisers'          },
  { sym:'DEEDEV',     name:'Dee Development Engineers'   },
  { sym:'DIACABS',    name:'Diamond Cables'              },
  { sym:'DRREDDY',    name:"Dr. Reddy's Laboratories"    },
  { sym:'EMMVEE',     name:'Emmvee Photovoltaic Power'   },
  { sym:'ENRIN',      name:'Enrin Energy'                },
  { sym:'ETERNAL',    name:'Eternal Ltd (Zomato)'        },
  { sym:'FCL',        name:'Fineotex Chemical'           },
  { sym:'GESHIP',     name:'Great Eastern Shipping'      },
  { sym:'GMDCLTD',    name:'GMDC'                        },
  { sym:'GOODLUCK',   name:'Good Luck India'             },
  { sym:'GPIL',       name:'Godawari Power & Ispat'      },
  { sym:'GRANULES',   name:'Granules India'              },
  { sym:'GRAPHITE',   name:'Graphite India'              },
  { sym:'GRWRHITECH', name:'Grauer & Weil (India)'       },
  { sym:'HFCL',       name:'HFCL Ltd'                    },
  { sym:'IFCI',       name:'IFCI Ltd'                    },
  { sym:'JAYNECOIND', name:'Jay NE Co Industries'        },
  { sym:'KIRLOSENG',  name:'Kirloskar Oil Engines'       },
  { sym:'KMEW',       name:'K & M Engineering'           },
  { sym:'KRISHANA',   name:'Krishana Phoschem'           },
  { sym:'KSL',        name:'KSL and Industries'          },
  { sym:'LLOYDSENT',  name:'Lloyds Enterprises'          },
  { sym:'LUMAXTECH',  name:'Lumax Technologies'          },
  { sym:'MARINE',     name:'Marine Electricals'          },
  { sym:'MTARTECH',   name:'MTAR Technologies'           },
  { sym:'NATIONALUM', name:'National Aluminium'          },
  { sym:'NETWEB',     name:'Netweb Technologies'         },
  { sym:'NLCINDIA',   name:'NLC India'                   },
  { sym:'NTPC',       name:'NTPC'                        },
  { sym:'PAISALO',    name:'Paisalo Digital'             },
  { sym:'POCL',       name:'Pocl Enterprises'            },
  { sym:'PREMEXPLN',  name:'Premier Explosives'          },
  { sym:'RRKABEL',    name:'RR Kabel'                    },
  { sym:'SANSERA',    name:'Sansera Engineering'         },
  { sym:'SCI',        name:'Shipping Corporation of India'},
  { sym:'SEAMECLTD',  name:'Seamec Ltd'                  },
  { sym:'SEDEMAC',    name:'Sedemac Mechatronics'        },
  { sym:'SHILPAMED',  name:'Shilpa Medicare'             },
  { sym:'SHRIPISTON', name:'Shriram Pistons & Rings'     },
  { sym:'SJS',        name:'SJS Enterprises'             },
  { sym:'SPORTKING',  name:'Sportking India'             },
  { sym:'STLTECH',    name:'Sterlite Technologies'       },
  { sym:'SYRMA',      name:'Syrma SGS Technology'        },
  { sym:'TMB',        name:'Tamilnad Mercantile Bank'    },
  { sym:'UNIVCABLES', name:'Universal Cables'            },
  { sym:'VISHNU',     name:'Vishnu Chemicals'            },
  { sym:'VTL',        name:'Vardhman Textiles'           },
  { sym:'WHEELS',     name:'Wheels India'                },
  { sym:'ZENTEC',     name:'Zen Technologies'            },
  { sym:'NETWEB',     name:'Netweb Technologies'         },
].filter((v,i,a) => a.findIndex(x=>x.sym===v.sym)===i); // deduplicate by sym

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

// Remove zero-volume holiday fillers and fix corporate-action price artifacts
function cleanOHLC(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    let { date, open, high, low, close } = rows[i];

    // Fix unadjusted-open artifacts: when HIGH or LOW is >2x away from the day's close,
    // the open was unadjusted on an ex-bonus/split day while intraday trade was at the new level.
    // NSE circuit limits mean HIGH/close > 2.0 or close/LOW > 2.0 can never happen legitimately.
    if (high > close * 2.0) high = +(close * 1.05).toFixed(2);
    if (close > low  * 2.0) low  = +(close * 0.95).toFixed(2);
    // Clamp open to same bounds so candlestick renders correctly
    if (open > close * 2.0) open = +(close * 1.02).toFixed(2);
    if (close > open * 2.0) open = +(close * 0.98).toFixed(2);

    // Fix full-row spike: close itself diverges >35% from both neighbours and immediately reverses
    // (covers zero-vol holiday rows that slipped through, and single-day price errors)
    if (i > 0 && i < rows.length - 1) {
      const pc = out[out.length - 1].close;
      const nc = rows[i + 1].close;
      const rb = close / pc;
      const ra = nc / close;
      if ((rb > 1.35 && ra < 1 / 1.35) || (rb < 1 / 1.35 && ra > 1.35)) {
        const sf = pc / close;
        out.push({ date, open: +(open*sf).toFixed(2), high: +(high*sf).toFixed(2), low: +(low*sf).toFixed(2), close: +(close*sf).toFixed(2) });
        continue;
      }
    }

    out.push({ date, open, high, low, close });
  }
  return out;
}

function mergeRows(sym) {
  // Prefer adjusted data from Yahoo Finance
  const adjPath = path.join(ADJ_DIR, `${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    const rows = parseCSV(fs.readFileSync(adjPath, 'utf8'))
      .filter(r => parseInt(r.Volume || r.volume || 0) > 0)  // drop zero-volume holiday fillers
      .map(r => ({
        date:  (r.Date  || r.date  || '').trim(),
        open:  parseFloat(r.Open  || r.open  || 0),
        high:  parseFloat(r.High  || r.high  || 0),
        low:   parseFloat(r.Low   || r.low   || 0),
        close: parseFloat(r.Close || r.close || 0),
      }))
      .filter(r => r.date && r.high > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    return cleanOHLC(rows);
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
  return cleanOHLC(rows.filter(r => r.date >= '2000-01-01').sort((a,b) => a.date.localeCompare(b.date)));
}

// ── Monthly Breakout symbols ──────────────────────────────────
const MB_INSTRUMENTS = [
  { sym:'HINDALCO',   name:'Hindalco Industries'     },
  { sym:'GRASIM',     name:'Grasim Industries'        },
  { sym:'SOLARINDS',  name:'Solar Industries'         },
  { sym:'POWERINDIA', name:'Hitachi Energy India'     },
  { sym:'IDEA',       name:'Vodafone Idea'            },
  { sym:'MOTHERSON',  name:'Samvardhana Motherson'    },
  { sym:'POLYCAB',    name:'Polycab India'            },
  { sym:'APOLLOHOSP', name:'Apollo Hospitals'         },
  { sym:'MAXHEALTH',  name:'Max Healthcare'           },
  { sym:'MANKIND',    name:'Mankind Pharma'           },
  { sym:'AUROPHARMA', name:'Aurobindo Pharma'         },
  { sym:'MCX',        name:'MCX India'                },
  { sym:'FORTIS',     name:'Fortis Healthcare'        },
  { sym:'LAURUSLABS', name:'Laurus Labs'              },
  { sym:'NAM-INDIA',  name:'Nippon Life India AMC'    },
  { sym:'ANGELONE',   name:'Angel One'                },
];

// Symbols in MB_INSTRUMENTS that are NOT already in ALL_INSTRUMENTS
const MB_ONLY_SYMS = new Set(['SOLARINDS','POWERINDIA','IDEA','MOTHERSON','MAXHEALTH','MANKIND','AUROPHARMA','FORTIS','LAURUSLABS','NAM-INDIA','ANGELONE']);

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

// Load OHLC for MB-only symbols
console.error('Processing Monthly Breakout extra symbols...');
for (const { sym } of MB_INSTRUMENTS) {
  if (ohlcBlocks[sym]) continue;
  const rows = mergeRows(sym);
  console.error(`  ${sym}: ${rows.length} rows (${rows[0]?.date} → ${rows[rows.length-1]?.date})`);
  ohlcBlocks[sym] = rows.map(r => `['${r.date}',${r.open.toFixed(2)},${r.high.toFixed(2)},${r.low.toFixed(2)},${r.close.toFixed(2)}]`).join(',');
}

// Load OHLC for Swing HIGH RS symbols (from parquet)
console.error('Processing Swing HIGH RS symbols (parquet)...');
const SRS_ONLY = SRS_INSTRUMENTS.filter(i => !ohlcBlocks[i.sym]);
for (const { sym } of SRS_ONLY) {
  const raw = readParquet(sym);
  if (!raw.length) { ohlcBlocks[sym] = ''; continue; }
  console.error(`  ${sym}: ${raw.length} rows (${raw[0][0]} → ${raw[raw.length-1][0]})`);
  ohlcBlocks[sym] = raw.map(r => `['${r[0]}',${(+r[1]).toFixed(2)},${(+r[2]).toFixed(2)},${(+r[3]).toFixed(2)},${(+r[4]).toFixed(2)}]`).join(',');
}

// Build deduplicated list of all symbols that need OHLC in the HTML
const seenOhlc = new Set();
const ohlcSymList = [];
for (const arr of [ALL_INSTRUMENTS, MB_INSTRUMENTS, SRS_INSTRUMENTS]) {
  for (const { sym, isIndex } of arr) {
    if (isIndex || seenOhlc.has(sym)) continue;
    if (ohlcBlocks[sym] === undefined) continue; // never loaded
    seenOhlc.add(sym);
    ohlcSymList.push(sym);
  }
}
const ohlcDataJS = ohlcSymList.map(sym => `  '${sym}':[${ohlcBlocks[sym] || ''}]`).join(',\n');

// ── Selector options ──────────────────────────────────────────
const instrOptionsNifty = INSTRUMENTS.map(({ sym, name }) =>
  `<option value="${sym}">${name}</option>`
).join('\n        ');

const instrOptionsMidcap = MIDCAP_INSTRUMENTS.map(({ sym, name }) =>
  `<option value="${sym}">${name}</option>`
).join('\n        ');

const instrOptionsMB = MB_INSTRUMENTS.map(({ sym, name }) =>
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
    --bg:#0d1117; --panel:#161b22; --panel2:#1c2128; --border:#30363d; --border-sub:#21262d;
    --accent:#58a6ff; --accent-dim:rgba(88,166,255,.12); --accent-dim2:rgba(88,166,255,.2);
    --green:#3fb950; --red:#f85149; --orange:#e3b341;
    --text:#c9d1d9; --sub:#8b949e;
    --hbg:#0d2818; --lbg:#2d1010; --hlbg:#2d2010; --conf:#ffe066;
    --shadow-sm:0 1px 4px rgba(0,0,0,.35); --shadow-md:0 4px 16px rgba(0,0,0,.5);
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; font-size:13px; line-height:1.5; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:#484f58; }

  /* ── App shell ── */
  .app-header { background:linear-gradient(180deg,var(--panel2) 0%,var(--panel) 100%); border-bottom:1px solid var(--border); padding:14px 24px 0; }
  .app-title { color:var(--accent); font-size:18px; font-weight:800; letter-spacing:-.3px; margin-bottom:12px; }
  .app-title span { color:var(--sub); font-weight:400; font-size:13px; margin-left:8px; }

  /* ── Tabs ── */
  .tab-nav { display:flex; gap:2px; }
  .tab-btn { background:transparent; border:none; color:var(--sub); font-size:13px; font-family:inherit; padding:9px 22px; cursor:pointer; border-bottom:2px solid transparent; transition:color .18s,border-color .18s; white-space:nowrap; font-weight:500; }
  .tab-btn:hover { color:var(--text); }
  .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); font-weight:700; }
  .tab-content { display:none; padding:24px; }
  .tab-content.active { display:block; }

  /* ── Shared controls ── */
  .ctrl-row { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px 20px; margin-bottom:20px; box-shadow:var(--shadow-sm); }
  .ctrl { display:flex; flex-direction:column; gap:5px; }
  .ctrl label { color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; }
  .ctrl input, .ctrl select { background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:7px; padding:6px 10px; font-size:14px; font-weight:600; outline:none; cursor:pointer; transition:border-color .15s, box-shadow .15s; font-family:inherit; }
  .ctrl input:hover, .ctrl select:hover { border-color:var(--sub); }
  .ctrl input:focus, .ctrl select:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-dim); }
  .ctrl input  { width:90px; text-align:center; font-size:18px; }
  .ctrl select { min-width:160px; }
  .ctrl select option { background:var(--bg); }
  .zz-wrap { display:flex; gap:14px; }
  .zz-wrap.hidden { display:none; }

  .cycle-pills { display:flex; flex-wrap:wrap; gap:6px; align-self:center; }
  .pill { background:var(--border-sub); border:1px solid var(--border); color:var(--sub); border-radius:20px; padding:3px 10px; font-size:11px; }
  .pill span { color:var(--accent); font-weight:700; }

  /* ── Shared badge styles ── */
  .ev { border-radius:5px; padding:2px 7px; font-size:11px; display:inline-block; margin:1px; white-space:nowrap; font-weight:700; cursor:default; letter-spacing:.1px; transition:opacity .12s; }
  .ev:hover { opacity:.85; }
  .ev-h  { background:var(--hbg);  color:var(--green);  border:1px solid #1f5a30; }
  .ev-l  { background:var(--lbg);  color:var(--red);    border:1px solid #5a1f1f; }
  .ev-hl { background:var(--hlbg); color:var(--orange); border:1px solid #5a3d1f; }

  /* ── Legend ── */
  .legend { display:flex; gap:20px; margin-bottom:14px; align-items:center; flex-wrap:wrap; }
  .leg { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--sub); }
  .dot { width:9px; height:9px; border-radius:3px; flex-shrink:0; }

  /* ══ TAB 1 — Natural Cycle ══ */
  .wrap { overflow-x:auto; border-radius:8px; }
  table.nc-table { border-collapse:collapse; width:100%; min-width:960px; }
  .nc-table thead th { background:var(--panel2); color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; padding:9px 8px; border:1px solid var(--border); text-align:center; position:sticky; top:0; z-index:3; }
  .nc-table thead th:first-child { text-align:left; padding-left:14px; min-width:130px; z-index:4; position:sticky; left:0; border-right:2px solid var(--border); }
  .nc-table thead th:nth-child(2) { min-width:55px; }
  .nc-table tbody td { border:1px solid var(--border); padding:6px 8px; text-align:center; min-width:78px; vertical-align:top; transition:background .1s; }
  .nc-table tbody td:first-child { text-align:left; padding:7px 12px; background:#1a1f28; font-size:11px; position:sticky; left:0; z-index:1; min-width:130px; border-right:2px solid var(--border); }
  .nc-table tbody td:nth-child(2) { color:var(--sub); font-size:11px; background:var(--panel); text-align:center; }
  .nc-table tbody tr:hover td { background:#1e2533 !important; }
  .nc-table tbody tr:hover td:first-child { background:#222d40 !important; }
  .yr-label { color:var(--accent); font-weight:700; font-size:13px; display:block; }
  .cycle-tag { color:var(--sub); font-size:10px; }
  .conf-row td { background:rgba(255,224,102,.05) !important; }
  .conf-row td:first-child { background:rgba(255,224,102,.07) !important; color:var(--conf); font-weight:700; }

  .conf-section { margin-top:24px; background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:18px 22px; box-shadow:var(--shadow-sm); }
  .conf-section h3 { color:var(--conf); font-size:13px; font-weight:700; margin-bottom:14px; letter-spacing:.2px; }
  .conf-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:10px; }
  .conf-month-label { font-size:10px; font-weight:700; color:var(--sub); text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; text-align:center; }
  .conf-item { text-align:center; border-radius:5px; padding:3px 4px; margin-bottom:3px; font-size:10px; font-weight:700; }
  .conf-h  { background:var(--hbg);  color:var(--green);  border:1px solid #1f5a30; }
  .conf-l  { background:var(--lbg);  color:var(--red);    border:1px solid #5a1f1f; }
  .conf-hl { background:var(--hlbg); color:var(--orange); border:1px solid #5a3d1f; }
  .conf-count { font-size:9px; opacity:.65; }

  /* ══ TAB 2 — Confluence Calendar ══ */
  .summary-bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-left:auto; }
  .stat { background:var(--panel2); border:1px solid var(--border); border-radius:6px; padding:5px 12px; font-size:11px; color:var(--sub); }
  .stat span { color:var(--accent); font-weight:700; }

  .filter-strip { display:flex; gap:6px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
  .filter-strip label { color:var(--sub); font-size:11px; }
  .fsep { width:1px; height:18px; background:var(--border); margin:0 2px; }
  .filter-btn { background:transparent; border:1px solid var(--border); color:var(--sub); border-radius:20px; padding:4px 13px; font-size:11px; cursor:pointer; font-family:inherit; transition:color .15s,border-color .15s,background .15s; }
  .filter-btn:hover { color:var(--text); border-color:var(--sub); }
  .filter-btn.active { background:var(--accent-dim); border-color:var(--accent); color:var(--accent); font-weight:600; }
  .view-toggle { display:flex; gap:4px; margin-left:auto; background:var(--panel2); border:1px solid var(--border); border-radius:7px; padding:3px; }
  .vtbtn { background:transparent; border:none; color:var(--sub); border-radius:5px; padding:3px 14px; font-size:11px; cursor:pointer; font-family:inherit; transition:color .15s,background .15s; }
  .vtbtn.active { background:var(--accent-dim2); color:var(--accent); font-weight:600; }

  #dateView { display:flex; flex-direction:column; gap:10px; }
  #mb-dateView { display:flex; flex-direction:column; gap:10px; }
  #mb-stockView { display:none; }
  #srs-dateView { display:flex; flex-direction:column; gap:10px; }
  #srs-stockView { display:none; }
  .date-card { background:var(--panel); border:1px solid var(--border); border-radius:10px; overflow:hidden; transition:border-color .15s, box-shadow .15s; }
  .date-card:hover { border-color:#484f58; box-shadow:var(--shadow-md); }
  .date-header { display:flex; align-items:center; gap:14px; padding:12px 18px; background:var(--panel2); border-bottom:1px solid var(--border); }
  .date-num { font-size:30px; font-weight:800; color:var(--conf); line-height:1; min-width:44px; letter-spacing:-1px; }
  .date-sublabel { color:var(--sub); font-size:12px; line-height:1.4; }
  .stock-count-badge { margin-left:auto; background:#332b10; border:1px solid #5a4a18; color:var(--conf); border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; }
  .stock-count-badge.multi { background:#0d2818; border-color:#1f5a30; color:var(--green); }
  .stocks-grid { display:flex; flex-wrap:wrap; gap:8px; padding:14px 16px; }
  .stock-chip { border-radius:8px; padding:8px 12px; font-size:11px; border:1px solid; min-width:148px; position:relative; transition:transform .15s, box-shadow .15s; }
  .stock-chip:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,.4); }
  .chip-h  { background:var(--hbg);  border-color:#1f5a30; }
  .chip-l  { background:var(--lbg);  border-color:#5a1f1f; }
  .chip-hl { background:var(--hlbg); border-color:#5a3d1f; }
  .chip-sym  { font-weight:700; font-size:12px; margin-bottom:2px; }
  .chip-sym.h  { color:var(--green);  }
  .chip-sym.l  { color:var(--red);    }
  .chip-sym.hl { color:var(--orange); }
  .chip-name { color:var(--sub); font-size:10px; margin-bottom:5px; }
  .chip-meta .yr { color:var(--sub); margin-right:3px; font-size:10px; }
  .chip-count { float:right; font-weight:700; font-size:11px; }
  .chip-count.h  { color:var(--green);  }
  .chip-count.l  { color:var(--red);    }
  .chip-count.hl { color:var(--orange); }

  #stockView { display:none; }
  .stock-table { width:100%; border-collapse:collapse; }
  .stock-table th { background:var(--panel2); color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; padding:9px 12px; border:1px solid var(--border); text-align:left; position:sticky; top:0; }
  .stock-table td { border:1px solid var(--border); padding:9px 12px; vertical-align:top; }
  .stock-table td:first-child { font-weight:700; color:var(--accent); min-width:110px; }
  .stock-table td:nth-child(2) { color:var(--sub); font-size:11px; min-width:180px; }
  .stock-table tr:hover td { background:#1e2533; }
  .no-conf { color:#2a3040; font-style:italic; font-size:11px; }

  .empty-state { text-align:center; padding:60px 20px; color:var(--sub); font-size:13px; }

  /* ── Chart button ── */
  .chart-btn { background:var(--panel2); border:1px solid var(--border); color:var(--sub); border-radius:7px; padding:6px 13px; font-size:12px; cursor:pointer; white-space:nowrap; transition:color .15s,border-color .15s,background .15s; font-family:inherit; }
  .chart-btn:hover { color:var(--accent); border-color:var(--accent); background:var(--accent-dim); }
  .chip-chart-btn { background:transparent; border:none; color:var(--sub); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:4px; line-height:1; float:right; transition:color .12s,background .12s; }
  .chip-chart-btn:hover { color:var(--accent); background:rgba(88,166,255,.15); }

  /* ── Modal ── */
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.8); display:none; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(3px); }
  .modal-overlay.open { display:flex; }
  .modal-box { background:var(--panel); border:1px solid var(--border); border-radius:12px; width:92vw; max-width:1200px; height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,.7); }
  .modal-hdr { display:flex; align-items:center; gap:12px; padding:13px 20px; background:var(--panel2); border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; }
  .modal-sym { font-size:17px; font-weight:800; color:var(--accent); letter-spacing:-.2px; }
  .modal-name { font-size:12px; color:var(--sub); margin-top:1px; }
  .modal-ctrls { display:flex; gap:10px; align-items:center; margin-left:auto; flex-wrap:wrap; }
  .modal-ctrls select { background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:5px 9px; font-size:12px; cursor:pointer; font-family:inherit; transition:border-color .15s; }
  .modal-ctrls select:hover { border-color:var(--sub); }
  .modal-range-btns { display:flex; gap:3px; background:var(--bg); border:1px solid var(--border); border-radius:7px; padding:2px; }
  .range-btn { background:transparent; border:none; color:var(--sub); border-radius:5px; padding:3px 10px; font-size:11px; cursor:pointer; font-family:inherit; transition:color .15s,background .15s; }
  .range-btn.active { background:var(--accent-dim2); color:var(--accent); font-weight:600; }
  .modal-close { background:transparent; border:none; color:var(--sub); font-size:18px; cursor:pointer; padding:3px 8px; border-radius:6px; margin-left:6px; transition:color .15s,background .15s; line-height:1; }
  .modal-close:hover { color:var(--text); background:var(--border); }
  .modal-body { flex:1; min-height:0; position:relative; }
  #modal-chart-container { width:100%; height:100%; }
  .modal-pivots { flex-shrink:0; max-height:90px; overflow-y:auto; padding:8px 16px; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; gap:4px; align-content:flex-start; }
  .modal-no-data { display:flex; align-items:center; justify-content:center; height:100%; color:var(--sub); font-size:14px; }

  /* ══ TAB 3 — Long Best Names ══ */
  .lb-section-title { color:var(--sub); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; margin:24px 0 12px; display:flex; align-items:center; gap:8px; }
  .lb-section-title::after { content:''; flex:1; height:1px; background:var(--border); }
  .lb-wrap { overflow-x:auto; border-radius:8px; margin-bottom:28px; }
  table.lb-table { border-collapse:collapse; width:100%; min-width:1000px; }
  .lb-table thead th { background:var(--panel2); color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; padding:8px 6px; border:1px solid var(--border); text-align:center; position:sticky; top:0; z-index:3; white-space:nowrap; }
  .lb-table thead th:first-child { text-align:left; padding-left:14px; min-width:150px; z-index:4; position:sticky; left:0; border-right:2px solid var(--border); }
  .lb-table tbody tr:hover td { background:#1e2533 !important; }
  .lb-table tbody tr:hover td:first-child { background:#222d40 !important; }
  .lb-sym-cell { text-align:left; padding:8px 12px; background:#1a1f28; position:sticky; left:0; z-index:1; border:1px solid var(--border); border-right:2px solid var(--border); }
  .lb-sym { color:var(--accent); font-weight:700; font-size:13px; }
  .lb-symname { color:var(--sub); font-size:10px; margin-top:1px; }
  .lb-cell { border:1px solid var(--border); padding:5px 6px; text-align:center; min-width:72px; vertical-align:top; }
  .lb-cell.empty { color:var(--border); font-size:12px; }
  .lb-cell.has-conf { background:rgba(255,224,102,.03); }
  #lb-upcoming { display:flex; flex-direction:column; gap:10px; }
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
    <label style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;font-size:12px;color:var(--sub)">
      <input type="checkbox" id="mb-toggle" onchange="toggleMB()" style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer">
      <span style="color:var(--text)">Monthly Breakout Stocks</span>
      <span style="background:#1a2a3a;border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;color:var(--accent)">16 stocks</span>
    </label>
  </div>
  <nav class="tab-nav">
    <button class="tab-btn active" onclick="switchTab('nc',this)">Natural Cycle</button>
    <button class="tab-btn" onclick="switchTab('conf',this)">Confluence Calendar</button>
    <button class="tab-btn" onclick="switchTab('lb',this)">⭐ Long Best Names</button>
    <button class="tab-btn" onclick="switchTab('mb',this)">📊 Monthly Breakout</button>
    <button class="tab-btn" onclick="switchTab('srs',this)">🚀 Swing HIGH RS</button>
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
        <optgroup id="nc-mb-optgroup" label="Monthly Breakout" style="display:none">
        ${instrOptionsMB}
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

<!-- ══ TAB 5: Swing HIGH RS ════════════════════════════════ -->
<div id="tab-srs" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Month</label>
      <select id="srs-month" onchange="srsRender()">${monthOptions}</select>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <select id="srs-year" onchange="srsRender()">${yearOptions}</select>
    </div>
    <div class="ctrl">
      <label>ZigZag Deviation %</label>
      <select id="srs-dev" onchange="invalidateCache(); srsRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Min Bars (Depth)</label>
      <select id="srs-dep" onchange="invalidateCache(); srsRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <div class="summary-bar">
      <div class="stat">Dates with signal <span id="srs-stat-dates">—</span></div>
      <div class="stat">Stocks hit <span id="srs-stat-stocks">—</span></div>
      <div class="stat">Multi-stock dates <span id="srs-stat-multi">—</span></div>
    </div>
  </div>

  <div class="filter-strip">
    <label>Min stocks per date:</label>
    <button class="filter-btn active" onclick="srsSetMin(1,this)">Any (≥1)</button>
    <button class="filter-btn" onclick="srsSetMin(2,this)">≥2 stocks</button>
    <button class="filter-btn" onclick="srsSetMin(3,this)">≥3 stocks</button>
    <button class="filter-btn" onclick="srsSetMin(4,this)">≥4 stocks</button>
    <div class="fsep"></div>
    <div class="view-toggle">
      <button class="vtbtn active" onclick="srsSetView('date',this)">By Date</button>
      <button class="vtbtn" onclick="srsSetView('stock',this)">By Stock</button>
    </div>
  </div>

  <div id="srs-dateView"></div>
  <div id="srs-stockView">
    <table class="stock-table">
      <thead><tr><th>Stock</th><th>Instrument</th><th>Confluence Dates</th><th>Lookback Years</th></tr></thead>
      <tbody id="srs-stock-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ══ TAB 4: Monthly Breakout ════════════════════════════ -->
<div id="tab-mb" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Month</label>
      <select id="mb-month" onchange="mbRender()">${monthOptions}</select>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <select id="mb-year" onchange="mbRender()">${yearOptions}</select>
    </div>
    <div class="ctrl">
      <label>ZigZag Deviation %</label>
      <select id="mb-dev" onchange="invalidateCache(); mbRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Min Bars (Depth)</label>
      <select id="mb-dep" onchange="invalidateCache(); mbRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <div class="summary-bar">
      <div class="stat">Dates with signal <span id="mb-stat-dates">—</span></div>
      <div class="stat">Stocks hit <span id="mb-stat-stocks">—</span></div>
      <div class="stat">Multi-stock dates <span id="mb-stat-multi">—</span></div>
    </div>
  </div>

  <div class="filter-strip">
    <label>Min stocks per date:</label>
    <button class="filter-btn active" onclick="mbSetMin(1,this)">Any (≥1)</button>
    <button class="filter-btn" onclick="mbSetMin(2,this)">≥2 stocks</button>
    <button class="filter-btn" onclick="mbSetMin(3,this)">≥3 stocks</button>
    <button class="filter-btn" onclick="mbSetMin(4,this)">≥4 stocks</button>
    <div class="fsep"></div>
    <div class="view-toggle">
      <button class="vtbtn active" onclick="mbSetView('date',this)">By Date</button>
      <button class="vtbtn" onclick="mbSetView('stock',this)">By Stock</button>
    </div>
  </div>

  <div id="mb-dateView"></div>
  <div id="mb-stockView">
    <table class="stock-table">
      <thead><tr><th>Stock</th><th>Instrument</th><th>Confluence Dates</th><th>Lookback Years</th></tr></thead>
      <tbody id="mb-stock-tbody"></tbody>
    </table>
  </div>
</div>

<!-- ══ TAB 3: Long Best Names ════════════════════════════ -->
<div id="tab-lb" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Analysis Year</label>
      <input type="number" id="lb-year" value="2026" min="2000" max="2050" oninput="lbRender()">
    </div>
    <div class="ctrl">
      <label>ZigZag Deviation %</label>
      <select id="lb-dev" onchange="invalidateCache(); lbRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Min Bars (Depth)</label>
      <select id="lb-dep" onchange="invalidateCache(); lbRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <div class="summary-bar">
      <div class="stat">Active signals <span id="lb-stat-signals">—</span></div>
      <div class="stat">Upcoming dates <span id="lb-stat-upcoming">—</span></div>
    </div>
  </div>

  <div class="lb-section-title" id="lb-matrix-title">Full-Year Confluence Matrix — 15 Selected Stocks</div>
  <div class="lb-wrap">
    <table class="lb-table">
      <thead><tr>
        <th>Stock</th>
        <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
        <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
      </tr></thead>
      <tbody id="lb-tbody"></tbody>
    </table>
  </div>

  <div class="lb-section-title">Upcoming Confluence Dates (from today)</div>
  <div id="lb-upcoming"></div>
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

const LONG_BEST = [
  {sym:'ASIANPAINT', name:'Asian Paints'},
  {sym:'HCLTECH',    name:'HCL Technologies'},
  {sym:'HINDALCO',   name:'Hindalco'},
  {sym:'TRENT',      name:'Trent'},
  {sym:'LT',         name:'Larsen & Toubro'},
  {sym:'ICICIBANK',  name:'ICICI Bank'},
  {sym:'ADANIPORTS', name:'Adani Ports'},
  {sym:'JSWSTEEL',   name:'JSW Steel'},
  {sym:'SHRIRAMFIN', name:'Shriram Finance'},
  {sym:'PERSISTENT', name:'Persistent Systems'},
  {sym:'COFORGE',    name:'Coforge'},
  {sym:'INDHOTEL',   name:'Indian Hotels'},
  {sym:'SJVN',       name:'SJVN'},
  {sym:'HUDCO',      name:'HUDCO'},
  {sym:'RVNL',       name:'RVNL'},
];

const MONTHLY_BREAKOUT = [
  {sym:'HINDALCO',   name:'Hindalco Industries'},
  {sym:'GRASIM',     name:'Grasim Industries'},
  {sym:'SOLARINDS',  name:'Solar Industries'},
  {sym:'POWERINDIA', name:'Hitachi Energy India'},
  {sym:'IDEA',       name:'Vodafone Idea'},
  {sym:'MOTHERSON',  name:'Samvardhana Motherson'},
  {sym:'POLYCAB',    name:'Polycab India'},
  {sym:'APOLLOHOSP', name:'Apollo Hospitals'},
  {sym:'MAXHEALTH',  name:'Max Healthcare'},
  {sym:'MANKIND',    name:'Mankind Pharma'},
  {sym:'AUROPHARMA', name:'Aurobindo Pharma'},
  {sym:'MCX',        name:'MCX India'},
  {sym:'FORTIS',     name:'Fortis Healthcare'},
  {sym:'LAURUSLABS', name:'Laurus Labs'},
  {sym:'NAM-INDIA',  name:'Nippon Life India AMC'},
  {sym:'ANGELONE',   name:'Angel One'},
];

const SRS_LIST = ${JSON.stringify(SRS_INSTRUMENTS.map(({sym,name})=>({sym,name})))};

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
  const instr = [...INSTRUMENTS, ...MIDCAP_INSTRUMENTS, ...MONTHLY_BREAKOUT].find(i => i.sym === sym);
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
  const showMC = document.getElementById('midcap-toggle').checked;
  const showMB = document.getElementById('mb-toggle').checked;
  const list = [...INSTRUMENTS];
  if (showMC) list.push(...MIDCAP_INSTRUMENTS);
  if (showMB) list.push(...MONTHLY_BREAKOUT.filter(i => !list.some(x => x.sym === i.sym)));
  return list;
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

function toggleMB() {
  const show = document.getElementById('mb-toggle').checked;
  const grp = document.getElementById('nc-mb-optgroup');
  if (show) {
    grp.style.display = '';
  } else {
    grp.style.display = 'none';
    const sel = document.getElementById('nc-instr');
    const isMB = MONTHLY_BREAKOUT.some(i => i.sym === sel.value);
    if (isMB) { sel.value = 'NIFTY'; ncOnInstrChange(); }
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
  else if (id==='conf') cfRender();
  else if (id==='lb') lbRender();
  else if (id==='mb') mbRender();
  else if (id==='srs') srsRender();
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

// ════════════════════════════════════════════════════════
// TAB 3 — Long Best Names
// ════════════════════════════════════════════════════════
function lbRender() {
  const yr  = parseInt(document.getElementById('lb-year').value);
  if (!yr||yr<2000||yr>2100) return;
  const dev = parseFloat(document.getElementById('lb-dev').value);
  const dep = parseInt(document.getElementById('lb-dep').value);
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('lb-matrix-title').textContent =
    \`Full-Year Confluence Matrix — 15 Selected Stocks · ZigZag \${dev}% / \${dep} bars\`;

  // Build full matrix: stock → month → confluence map
  const matrix = LONG_BEST.map(({sym,name}) => ({
    sym, name,
    months: MONTHS.map((_,mi) => cfGetConfluence(sym,yr,mi,dev,dep))
  }));

  // Render matrix table
  let totalSignals = 0;
  document.getElementById('lb-tbody').innerHTML = matrix.map(({sym,name,months}) => {
    const cells = months.map((conf,mi) => {
      const entries = Object.entries(conf).sort((a,b)=>+a[0]-+b[0]);
      if (!entries.length) return \`<td class="lb-cell empty">—</td>\`;
      totalSignals += entries.length;
      const badges = entries.map(([day,arr])=>{
        const h=arr.some(e=>e.type==='H'), l=arr.some(e=>e.type==='L');
        const cls=(h&&l)?'ev-hl':h?'ev-h':'ev-l';
        const lbl=(h&&l)?\`\${day} H/L\`:h?\`\${day} H\`:\`\${day} L\`;
        const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
        return \`<span class="ev \${cls}" title="\${tip}">⚡\${lbl} ×\${arr.length}</span>\`;
      }).join('<br>');
      return \`<td class="lb-cell has-conf">\${badges}</td>\`;
    }).join('');
    return \`<tr>
      <td class="lb-sym-cell">
        <div class="lb-sym">\${sym}</div>
        <div class="lb-symname">\${name}</div>
      </td>
      \${cells}
    </tr>\`;
  }).join('');

  // Upcoming confluence dates (from today onwards)
  const upcoming = [];
  matrix.forEach(({sym,name,months}) => {
    months.forEach((conf,mi) => {
      Object.entries(conf).sort((a,b)=>+a[0]-+b[0]).forEach(([day,arr]) => {
        const dateStr = \`\${yr}-\${String(mi+1).padStart(2,'0')}-\${day}\`;
        if (dateStr < today) return;
        const h=arr.some(e=>e.type==='H'), l=arr.some(e=>e.type==='L');
        upcoming.push({dateStr,mi,day,sym,name,arr,cfType:(h&&l)?'HL':h?'H':'L',count:arr.length});
      });
    });
  });
  upcoming.sort((a,b)=>a.dateStr.localeCompare(b.dateStr));

  // Group by date
  const byDate = {};
  upcoming.forEach(u => { if(!byDate[u.dateStr]) byDate[u.dateStr]=[]; byDate[u.dateStr].push(u); });
  const dateKeys = Object.keys(byDate).sort();

  document.getElementById('lb-stat-signals').textContent = totalSignals;
  document.getElementById('lb-stat-upcoming').textContent = dateKeys.length;

  const upEl = document.getElementById('lb-upcoming');
  if (!dateKeys.length) {
    upEl.innerHTML = \`<div class="empty-state">No upcoming confluence signals for <strong>\${yr}</strong>.</div>\`;
    return;
  }
  upEl.innerHTML = dateKeys.map(dateStr => {
    const items = byDate[dateStr];
    const d = new Date(dateStr+'T00:00:00');
    const monthName = MONTHS[d.getMonth()];
    const dayNum = String(d.getDate()).padStart(2,'0');
    const isMulti = items.length >= 2;
    const chips = items.sort((a,b)=>b.count-a.count).map(({sym,name,arr,cfType}) => {
      const cls = cfType==='HL'?'hl':cfType==='H'?'h':'l';
      const yrs = arr.map(e=>\`<span class="yr">\${e.year}:\${e.type}</span>\`).join('');
      const chartBtn = \`<button class="chip-chart-btn" onclick="openChart('\${sym}','\${name.replace(/'/g,"\\\\'")}',\${dev},\${dep})" title="Open chart">📈</button>\`;
      return \`<div class="stock-chip chip-\${cls}">
        <div style="display:flex;align-items:center;justify-content:space-between">\${chartBtn}<div class="chip-sym \${cls}" style="flex:1">\${sym} <span class="chip-count \${cls}">×\${arr.length}</span></div></div>
        <div class="chip-name">\${name}</div>
        <div class="chip-meta">\${yrs}</div>
      </div>\`;
    }).join('');
    return \`<div class="date-card">
      <div class="date-header">
        <div class="date-num">\${dayNum}</div>
        <div>
          <div style="color:var(--conf);font-weight:700">\${dayNum} \${monthName} \${yr}</div>
          <div class="date-sublabel">\${items.length} stock\${items.length>1?'s':''} with Gann confluence</div>
        </div>
        <div class="stock-count-badge \${isMulti?'multi':''}">\${items.length} stock\${items.length>1?'s':''}</div>
      </div>
      <div class="stocks-grid">\${chips}</div>
    </div>\`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// TAB 4 — Monthly Breakout
// ════════════════════════════════════════════════════════
let _mbMin  = 1;
let _mbView = 'date';

function mbRender() {
  const monthIdx = parseInt(document.getElementById('mb-month').value);
  const year     = parseInt(document.getElementById('mb-year').value);
  const dev      = parseFloat(document.getElementById('mb-dev').value);
  const dep      = parseInt(document.getElementById('mb-dep').value);

  const dateMap={}, stockConf={};
  const stocksWithSignal=new Set();

  MONTHLY_BREAKOUT.forEach(({sym,name}) => {
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

  document.getElementById('mb-stat-dates').textContent  = sortedDays.length;
  document.getElementById('mb-stat-stocks').textContent = stocksWithSignal.size;
  document.getElementById('mb-stat-multi').textContent  = multiDays.length;

  const filtered = sortedDays.filter(d=>dateMap[d].length>=_mbMin);

  if (_mbView==='date') mbRenderDate(filtered, dateMap, monthIdx, year, dev, dep);
  else mbRenderStock(stockConf, monthIdx, year);
}

function mbRenderDate(days, dateMap, monthIdx, year, dev, dep) {
  const el=document.getElementById('mb-dateView');
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
      const chartBtn=\`<button class="chip-chart-btn" onclick="openChart('\${sym}','\${name.replace(/'/g,"\\\\'")}',\${dev},\${dep})" title="Open chart">📈</button>\`;
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

function mbRenderStock(stockConf, monthIdx, year) {
  const tbody=document.getElementById('mb-stock-tbody');
  const monthName=MONTHS_LONG[monthIdx];
  if (!Object.keys(stockConf).length) {
    tbody.innerHTML=\`<tr><td colspan="4" class="empty-state">No confluence dates for \${monthName} \${year}.</td></tr>\`;
    return;
  }
  tbody.innerHTML=MONTHLY_BREAKOUT.map(({sym,name}) => {
    const sc=stockConf[sym];
    if (!sc) {
      if (_mbMin>1) return '';
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

function mbSetMin(n,btn) {
  _mbMin=n;
  document.querySelectorAll('#tab-mb .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  mbRender();
}
function mbSetView(v,btn) {
  _mbView=v;
  document.querySelectorAll('#tab-mb .vtbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('mb-dateView').style.display  = v==='date'?'flex':'none';
  document.getElementById('mb-stockView').style.display = v==='stock'?'block':'none';
  mbRender();
}

// ════════════════════════════════════════════════════════
// TAB 5 — Swing HIGH RS
// ════════════════════════════════════════════════════════
let _srsMin  = 1;
let _srsView = 'date';

function srsRender() {
  const monthIdx = parseInt(document.getElementById('srs-month').value);
  const year     = parseInt(document.getElementById('srs-year').value);
  const dev      = parseFloat(document.getElementById('srs-dev').value);
  const dep      = parseInt(document.getElementById('srs-dep').value);

  const dateMap={}, stockConf={};
  const stocksWithSignal=new Set();

  SRS_LIST.forEach(({sym,name}) => {
    if (!OHLC_DATA[sym] || !OHLC_DATA[sym].length) return;
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

  document.getElementById('srs-stat-dates').textContent  = sortedDays.length;
  document.getElementById('srs-stat-stocks').textContent = stocksWithSignal.size;
  document.getElementById('srs-stat-multi').textContent  = multiDays.length;

  const filtered = sortedDays.filter(d=>dateMap[d].length>=_srsMin);

  if (_srsView==='date') srsRenderDate(filtered, dateMap, monthIdx, year, dev, dep);
  else srsRenderStock(stockConf, monthIdx, year);
}

function srsRenderDate(days, dateMap, monthIdx, year, dev, dep) {
  const el=document.getElementById('srs-dateView');
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
      const chartBtn=\`<button class="chip-chart-btn" onclick="openChart('\${sym}','\${name.replace(/'/g,"\\\\'")}',\${dev},\${dep})" title="Open chart">📈</button>\`;
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

function srsRenderStock(stockConf, monthIdx, year) {
  const tbody=document.getElementById('srs-stock-tbody');
  const monthName=MONTHS_LONG[monthIdx];
  if (!Object.keys(stockConf).length) {
    tbody.innerHTML=\`<tr><td colspan="4" class="empty-state">No confluence dates for \${monthName} \${year}.</td></tr>\`;
    return;
  }
  tbody.innerHTML=SRS_LIST.map(({sym,name}) => {
    const sc=stockConf[sym];
    if (!sc) {
      if (_srsMin>1) return '';
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

function srsSetMin(n,btn) {
  _srsMin=n;
  document.querySelectorAll('#tab-srs .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  srsRender();
}
function srsSetView(v,btn) {
  _srsView=v;
  document.querySelectorAll('#tab-srs .vtbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('srs-dateView').style.display  = v==='date'?'flex':'none';
  document.getElementById('srs-stockView').style.display = v==='stock'?'block':'none';
  srsRender();
}

// ── Init ───────────────────────────────────────────────
ncRender();
</script>
</body>
</html>`;

fs.writeFileSync('j:/GANN Claude/Gann/6/trial_natural_cycle.html', html, 'utf8');
const size = (fs.statSync('j:/GANN Claude/Gann/6/trial_natural_cycle.html').size/1024/1024).toFixed(1);
console.error(`Done. trial_natural_cycle.html — ${size} MB`);
