// build_swing_rs.js
// Builds Gann/6/swing_rs.html — standalone Cash Stocks Gann dashboard
// Blue list + Execution watchlists + Invest Domain tab
// OHLC from J:/Winning Characteristics/Final Data/*.parquet
// node build_swing_rs.js

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os   = require('os');

const PARQUET_DIR      = 'J:/Winning Characteristics/Final Data';
const ADJ_DIR          = 'j:/Swing Trading/Swing Trading/processed_adj_cash';
const PROCESSED_DIR    = 'j:/Swing Trading/Swing Trading/processed';
const OUT_FILE         = 'j:/GANN Claude/Gann/6/swing_rs.html';
const BEST_COMBOS_FILE = 'j:/GANN Claude/Backtest/best_combos_cash.json';

// ── Blue + Execution combined, alphabetical, 2025+ cutoff ─────
const INSTRUMENTS = [
  { sym:'AADHARHFC',  name:'Aadhar Housing Finance'        },
  { sym:'ABSMARINE',  name:'ABS Marine Services'           },
  { sym:'ABSLAMC',    name:'Aditya Birla Sun Life AMC'     },
  { sym:'ACCENTMIC',  name:'Accent Microcell'              },
  { sym:'ADANIENT',   name:'Adani Enterprises'             },
  { sym:'ADANIENSOL', name:'Adani Energy Solutions'        },
  { sym:'ADANIPOWER', name:'Adani Power'                   },
  { sym:'AEROFLEX',   name:'Aeroflex Industries'           },
  { sym:'AETHER',     name:'Aether Industries'             },
  { sym:'AIMTRON',    name:'Aimtron Electronics'           },
  { sym:'ANGELONE',   name:'Angel One'                     },
  { sym:'APLAPOLLO',  name:'APL Apollo Tubes'              },
  { sym:'APEX',       name:'Apex Frozen Foods'             },
  { sym:'ARIES',      name:'Aries Agro'                    },
  { sym:'ARVIND',     name:'Arvind Ltd'                    },
  { sym:'ASKAUTOLTD', name:'ASK Automotive'                },
  { sym:'ASTEC',      name:'Astec LifeSciences'            },
  { sym:'ASTERDM',    name:'Aster DM Healthcare'           },
  { sym:'ASTRAMICRO', name:'Astra Microwave Products'      },
  { sym:'ATALREAL',   name:'Atal Realtech'                 },
  { sym:'ATGL',       name:'Adani Total Gas'               },
  { sym:'AVALON',     name:'Avalon Technologies'           },
  { sym:'AVANTIFEED', name:'Avanti Feeds'                  },
  { sym:'AXISCADES',  name:'Axiscades Technologies'        },
  { sym:'AZAD',       name:'Azad Engineering'              },
  { sym:'BAJAJCON',   name:'Bajaj Consumer Care'           },
  { sym:'BANCOINDIA', name:'Banco Products'                },
  { sym:'BBOX',       name:'Black Box Ltd'                 },
  { sym:'BHEL',       name:'Bharat Heavy Electricals'      },
  { sym:'BLACKBUCK',  name:'Zinka Logistics (BlackBuck)'   },
  { sym:'BLISSGVS',   name:'Bliss GVS Pharma'             },
  { sym:'BSE',        name:'BSE Ltd'                       },
  { sym:'CARERATING', name:'CARE Ratings'                  },
  { sym:'CARRARO',    name:'Carraro India'                 },
  { sym:'CARYSIL',    name:'Carysil'                       },
  { sym:'CCL',        name:'CCL Products'                  },
  { sym:'CENTUM',     name:'Centum Electronics'            },
  { sym:'CFF',        name:'CFF Fluid Control'             },
  { sym:'CHENNPETRO', name:'Chennai Petroleum'             },
  { sym:'CNCRD',      name:'Concord Drugs'                 },
  { sym:'CUMMINSIND', name:'Cummins India'                 },
  { sym:'CUPID',      name:'Cupid Ltd'                     },
  { sym:'DATAMATICS', name:'Datamatics Global Services'    },
  { sym:'DATAPATTNS', name:'Data Patterns'                 },
  { sym:'DECNGOLD',   name:'Deccan Gold Mines'             },
  { sym:'DEEPAKFERT', name:'Deepak Fertilisers'            },
  { sym:'DEEPINDS',   name:'Deep Industries'               },
  { sym:'DEEDEV',     name:'Dee Development Engineers'     },
  { sym:'DIACABS',    name:'Diamond Cables'                },
  { sym:'DRREDDY',    name:"Dr. Reddy's Laboratories"      },
  { sym:'DREDGECORP', name:'Dredging Corporation'          },
  { sym:'DSSL',       name:'Dynacons Systems'              },
  { sym:'DYNAMATECH', name:'Dynamatic Technologies'        },
  { sym:'EMCURE',     name:'Emcure Pharmaceuticals'        },
  { sym:'ENDURANCE',  name:'Endurance Technologies'        },
  { sym:'ELECON',      name:'Elecon Engineering'             },
  { sym:'EQUITASBNK', name:'Equitas Small Finance Bank'    },
  { sym:'ESABINDIA',  name:'Esab India'                    },
  { sym:'EXIDEIND',   name:'Exide Industries'              },
  { sym:'FCL',        name:'Fineotex Chemical'             },
  { sym:'FEDERALBNK', name:'Federal Bank'                  },
  { sym:'FIEMIND',    name:'Fiem Industries'               },
  { sym:'FLUOROCHEM', name:'Gujarat Fluorochemicals'       },
  { sym:'GAIL',       name:'GAIL India'                    },
  { sym:'GENUSPOWER', name:'Genus Power'                   },
  { sym:'GESHIP',     name:'Great Eastern Shipping'        },
  { sym:'GICRE',      name:'GIC Re'                        },
  { sym:'GLAND',      name:'Gland Pharma'                  },
  { sym:'GLENMARK',   name:'Glenmark Pharma'               },
  { sym:'GMDCLTD',    name:'GMDC'                          },
  { sym:'GMBREW',     name:'GM Breweries'                  },
  { sym:'GOCLCORP',   name:'GOCL Corporation'              },
  { sym:'GODAVARIB',  name:'Godavari Biorefineries'        },
  { sym:'GOODLUCK',   name:'Good Luck India'               },
  { sym:'GOKULAGRO',  name:'Gokul Agro Resources'          },
  { sym:'GPIL',       name:'Godawari Power & Ispat'        },
  { sym:'GRANULES',   name:'Granules India'                },
  { sym:'GRAPHITE',   name:'Graphite India'                },
  { sym:'GRASIM',     name:'Grasim Industries'             },
  { sym:'GRSE',       name:'Garden Reach Shipbuilders'     },
  { sym:'GRMOVER',    name:'GRM Overseas'                  },
  { sym:'GRWRHITECH', name:'Grauer & Weil (India)'         },
  { sym:'GUJALKALI',  name:'Gujarat Alkalies'              },
  { sym:'GVTD',       name:'GVT&D'                         },
  { sym:'HAPPYFORGE', name:'Happy Forgings'                },
  { sym:'HBLENGINE',  name:'HBL Engineering'               },
  { sym:'HEG',        name:'HEG Ltd'                       },
  { sym:'HFCL',       name:'HFCL Ltd'                      },
  { sym:'HIRECT',     name:'Hi-Tech Pipes'                 },
  { sym:'IFCI',       name:'IFCI Ltd'                      },
  { sym:'IMFA',       name:'Indian Metals & Ferro Alloys'  },
  { sym:'INDIAGLYCO', name:'India Glycols'                 },
  { sym:'INDOBORAX',  name:'Indo Borax & Chemicals'        },
  { sym:'INOXINDIA',  name:'Inox India'                    },
  { sym:'IPCALAB',    name:'Ipca Laboratories'             },
  { sym:'JAMNAAUTO',  name:'Jamna Auto Industries'         },
  { sym:'JAYNECOIND', name:'Jay NE Co Industries'          },
  { sym:'JSFB',       name:'Jana Small Finance Bank'       },
  { sym:'JSLL',       name:'Jain Irrigation Systems'       },
  { sym:'KERNEX',     name:'Kernex Microsystems'           },
  { sym:'KIOCL',      name:'KIOCL Ltd'                     },
  { sym:'KIRLPNU',    name:'Kirloskar Pneumatic'           },
  { sym:'KIRLOSENG',  name:'Kirloskar Oil Engines'         },
  { sym:'KMEW',       name:"K&M Engineering"               },
  { sym:'KPL',        name:'KPL International'             },
  { sym:'KPIL',       name:'Kalpataru Projects'            },
  { sym:'KPIGREEN',   name:'KPI Green Energy'              },
  { sym:'KPRMILL',    name:'K.P.R. Mill'                   },
  { sym:'KRN',        name:'KRN Heat Exchanger'            },
  { sym:'KRISHANA',   name:'Krishana Phoschem'             },
  { sym:'KSL',        name:'KSL and Industries'            },
  { sym:'KTKBANK',    name:'Karnataka Bank'                },
  { sym:'LINDEINDIA', name:'Linde India'                   },
  { sym:'LLOYDSENT',  name:'Lloyds Enterprises'            },
  { sym:'LLOYDSME',   name:'Lloyds Metals & Energy'        },
  { sym:'LUMAXTECH',  name:'Lumax Technologies'            },
  { sym:'MANINDS',    name:'Man Industries'                },
  { sym:'MANORAMA',   name:'Manorama Industries'           },
  { sym:'MARINE',     name:'Marine Electricals'            },
  { sym:'MAYURUNIQ',  name:'Mayur Uniquoters'              },
  { sym:'MBAPL',      name:'Meghmani Organics'             },
  { sym:'MOREPENLAB', name:'Morepen Laboratories'          },
  { sym:'MTARTECH',   name:'MTAR Technologies'             },
  { sym:'NATIONALUM', name:'National Aluminium'            },
  { sym:'NETWEB',     name:'Netweb Technologies'           },
  { sym:'NGLFINE',    name:'NGL Fine-Chem'                 },
  { sym:'NLCINDIA',   name:'NLC India'                     },
  { sym:'NORTHARC',   name:'Northern Arc Capital'          },
  { sym:'NTPC',       name:'NTPC'                          },
  { sym:'NUVAMA',     name:'Nuvama Wealth Management'      },
  { sym:'OLECTRA',    name:'Olectra Greentech'             },
  { sym:'ONEPOINT',   name:'One Point One Solutions'       },
  { sym:'PAISALO',    name:'Paisalo Digital'               },
  { sym:'PARAS',      name:'Paras Defence'                 },
  { sym:'PFOCUS',     name:'Prime Focus'                   },
  { sym:'POCL',       name:'Pocl Enterprises'              },
  { sym:'POWERINDIA', name:'Hitachi Energy India'          },
  { sym:'PRECWIRE',   name:'Precision Wires'               },
  { sym:'PREMEXPLN',  name:'Premier Explosives'            },
  { sym:'PREMIERENE', name:'Premier Energies'              },
  { sym:'PRIVISCL',   name:'Privi Speciality Chemicals'    },
  { sym:'PSPPROJECT', name:'PSP Projects'                  },
  { sym:'RAIN',       name:'Rain Industries'               },
  { sym:'RANEHOLDIN', name:'Rane Holdings'                 },
  { sym:'ROSSTECH',   name:'Ross Tech'                     },
  { sym:'RRKABEL',    name:'RR Kabel'                      },
  { sym:'SAILIFE',    name:'SAI Life Sciences'             },
  { sym:'SANDHAR',    name:'Sandhar Technologies'          },
  { sym:'SANDUMA',    name:'Sandur Manganese'              },
  { sym:'SANGAMIND',  name:'Sangam India'                  },
  { sym:'SANSERA',    name:'Sansera Engineering'           },
  { sym:'SATIN',      name:'Satin Creditcare Network'      },
  { sym:'SCHNEIDER',  name:'Schneider Electric Infra'      },
  { sym:'SCI',        name:'Shipping Corporation of India' },
  { sym:'SEAMECLTD',  name:'Seamec Ltd'                    },
  { sym:'SENORES',    name:'Senores Pharmaceuticals'       },
  { sym:'SHAILY',     name:'Shaily Engineering Plastics'   },
  { sym:'SHARDACROP', name:'Sharda Cropchem'               },
  { sym:'SHILCTECH',  name:'Shilchar Technologies'         },
  { sym:'SHILPAMED',  name:'Shilpa Medicare'               },
  { sym:'SHRIPISTON', name:'Shriram Pistons & Rings'       },
  { sym:'SHYAMMETL',  name:'Shyam Metalics'                },
  { sym:'SJS',        name:'SJS Enterprises'               },
  { sym:'SKIPPER',    name:'Skipper Ltd'                   },
  { sym:'SKYGOLD',    name:'Sky Gold'                      },
  { sym:'SMSPHARMA',  name:'SMS Pharmaceuticals'           },
  { sym:'SOUTHBANK',  name:'South Indian Bank'             },
  { sym:'SOUTHWEST',  name:'South West Pinnacle Exp'       },
  { sym:'SPORTKING',  name:'Sportking India'               },
  { sym:'SSEGL',      name:'SSEL Ltd'                      },
  { sym:'STAR',       name:'Star Paper Mills'              },
  { sym:'STARHEALTH', name:'Star Health Insurance'         },
  { sym:'STLTECH',    name:'Sterlite Technologies'         },
  { sym:'SUNFLAG',    name:'Sunflag Iron & Steel'          },
  { sym:'SURYODAY',   name:'Suryoday Small Finance Bank'   },
  { sym:'SUZLON',     name:'Suzlon Energy'                 },
  { sym:'SYRMA',      name:'Syrma SGS Technology'          },
  { sym:'TATACOMM',   name:'Tata Communications'           },
  { sym:'TDPOWERSYS', name:'TD Power Systems'              },
  { sym:'TECHNOE',    name:'Techno Electric & Engg'        },
  { sym:'THERMAX',    name:'Thermax'                       },
  { sym:'THYROCARE',  name:'Thyrocare Technologies'        },
  { sym:'TI',         name:'Tube Investments of India'     },
  { sym:'TIPSMUSIC',  name:'Tips Music'                    },
  { sym:'TMB',        name:'Tamilnad Mercantile Bank'      },
  { sym:'TRENT',      name:'Trent Ltd'                     },
  { sym:'TUNWAL',     name:'Tunwal E-Motors'               },
  { sym:'TVSHLTD',    name:'TVS Holdings'                  },
  { sym:'UJJIVANSFB', name:'Ujjivan Small Finance Bank'    },
  { sym:'UNIVCABLES', name:'Universal Cables'              },
  { sym:'VALIANT',    name:'Valiant Laboratories'          },
  { sym:'VINDHYATEL', name:'Vindhya Telelinks'             },
  { sym:'VISHNU',     name:'Vishnu Chemicals'              },
  { sym:'VIVIANA',    name:'Viviana Power Tech'            },
  { sym:'VIPULORG',   name:'Vipul Organics'                },
  { sym:'VTL',        name:'Vardhman Textiles'             },
  { sym:'WAAREEENER', name:'Waaree Energies'               },
  { sym:'WABAG',      name:'VA Tech Wabag'                 },
  { sym:'WELENT',     name:'WEL Engineering'               },
  { sym:'WHEELS',     name:'Wheels India'                  },
  { sym:'WOCKPHARMA', name:'Wockhardt'                     },
  { sym:'YASHHV',     name:'Yash H.V. Welding Electrodes'  },
  { sym:'YATHARTH',   name:'Yatharth Hospital'             },
  { sym:'ZENTEC',     name:'Zen Technologies'              },
  { sym:'ZFCVINDIA',  name:'ZF Commercial Vehicle'         },
  { sym:'ZYDUSWELL',  name:'Zydus Wellness'                },
  // ── Added 2026-07-01 (from watchlists) ──────────────────────
  { sym:'ABDL',        name:'ABD Ltd'                          },
  { sym:'ACMESOLAR',   name:'Acme Solar Holdings'              },
  { sym:'ADANIPORTS',  name:'Adani Ports & SEZ'                },
  { sym:'ADVAIT',      name:'Advait Infratech'                 },
  { sym:'AEGISLOG',    name:'Aegis Logistics'                  },
  { sym:'AEQUS',       name:'Aequs Aerospace'                  },
  { sym:'AGI',         name:'AGI Infra'                        },
  { sym:'AMAGI',       name:'Amagi Media Labs'                 },
  { sym:'ANURAS',      name:'Anuras Tech'                      },
  { sym:'APOLLO',      name:'Apollo Micro Systems'             },
  { sym:'ARFIN',       name:'Arfin India'                      },
  { sym:'ARSSBL',      name:'ARS Multitrade'                   },
  { sym:'ASIANENE',    name:'Asian Energy Services'            },
  { sym:'ATHERENERG',  name:'Ather Energy'                     },
  { sym:'AYE',         name:'Aye Finance'                      },
  { sym:'BALAMINES',   name:'Balaji Amines'                    },
  { sym:'BANDHANBNK',  name:'Bandhan Bank'                     },
  { sym:'BANKINDIA',   name:'Bank of India'                    },
  { sym:'BELRISE',     name:'Belrise Industries'               },
  { sym:'BETA',        name:'Beta Drugs'                       },
  { sym:'BRIGADE',     name:'Brigade Enterprises'              },
  { sym:'CARTRADE',    name:'CarTrade Tech'                    },
  { sym:'CEMPRO',      name:'Cement Products of India'         },
  { sym:'COCHINSHIP',  name:'Cochin Shipyard'                  },
  { sym:'COCKERILL',   name:'John Cockerill India'             },
  { sym:'CPPLUS',      name:'CP Plus (Aditya Infotech)'        },
  { sym:'CUB',         name:'City Union Bank'                  },
  { sym:'DHANBANK',    name:'Dhanlaxmi Bank'                   },
  { sym:'DYCL',        name:'DYCL Ltd'                         },
  { sym:'EBGNG',       name:'EBGNG Ltd'                        },
  { sym:'EIEL',        name:'Eastern India Hotels'             },
  { sym:'EMMVEE',      name:'Emmvee Photovoltaic'              },
  { sym:'ENGINERSIN',  name:'Engineers India'                  },
  { sym:'ETERNAL',     name:'Eternal Ltd'                      },
  { sym:'GABRIEL',     name:'Gabriel India'                    },
  { sym:'GAEL',        name:'Gujarat Ambuja Exports'           },
  { sym:'GAUDIUMIVF',  name:'Gaudium IVF'                     },
  { sym:'GROWW',       name:'Groww (Nextbillion Tech)'         },
  { sym:'GUJTHEM',     name:'Gujarat Themis Biosyn'            },
  { sym:'HALEOSLABS',  name:'Haleo Labs'                       },
  { sym:'HSCL',        name:'Himadri Speciality Chemical'      },
  { sym:'INDHOTEL',    name:'Indian Hotels (Taj)'              },
  { sym:'INDSWFTLAB',  name:'Ind-Swift Laboratories'           },
  { sym:'JKBANK',      name:'J&K Bank'                         },
  { sym:'JTLIND',      name:'JTL Industries'                   },
  { sym:'KRISHNADEF',  name:'Krishna Defence'                  },
  { sym:'LENSKART',    name:'Lenskart Solutions'               },
  { sym:'LODHA',       name:'Macrotech Developers (Lodha)'     },
  { sym:'MAHABANK',    name:'Bank of Maharashtra'              },
  { sym:'MAXESTATES',  name:'Max Estates'                      },
  { sym:'NACLIND',     name:'NACL Industries'                  },
  { sym:'NAZARA',      name:'Nazara Technologies'              },
  { sym:'NRBBEARING',  name:'NRB Bearings'                     },
  { sym:'OLAELEC',     name:'Ola Electric Mobility'            },
  { sym:'ONESOURCE',   name:'OneSource Specialty Pharma'       },
  { sym:'PTCIL',       name:'PTC India Financial Services'     },
  { sym:'QPOWER',      name:'Q Power Infra'                    },
  { sym:'RAMCOIND',    name:'Ramco Industries'                 },
  { sym:'RAMCOSYS',    name:'Ramco Systems'                    },
  { sym:'RATEGAIN',    name:'RateGain Travel Technologies'     },
  { sym:'RAYMONDREL',  name:'Raymond Realty'                   },
  { sym:'RISHABH',     name:'Rishabh Instruments'              },
  { sym:'SASKEN',      name:'Sasken Technologies'              },
  { sym:'SBCL',        name:'Shivalik Bimetal Controls'        },
  { sym:'SEDEMAC',     name:'Sedemac Mechatronics'             },
  { sym:'SEIL',        name:'Sterling Energy Infrastructure'   },
  { sym:'SHADOWFAX',   name:'Shadowfax Technologies'           },
  { sym:'SHREEPUSHK',  name:'Shree Pushkar Chemicals'          },
  { sym:'SIKA',        name:'Sika India'                       },
  { sym:'SKMEGGPROD',  name:'SKM Egg Products'                 },
  { sym:'SOLARINDS',   name:'Solar Industries India'           },
  { sym:'SOTL',        name:'Savita Oil Technologies'          },
  { sym:'SUDEEPPHRM',  name:'Sudeep Pharmaceuticals'           },
  { sym:'SUPRIYA',     name:'Supriya Lifescience'              },
  { sym:'SURYAROSNI',  name:'Surya Roshni'                     },
  { sym:'SUVEN',       name:'Suven Pharmaceuticals'            },
  { sym:'TALBROAUTO',  name:'Talbros Automotive'               },
  { sym:'TEJASNET',    name:'Tejas Networks'                   },
  { sym:'UTLSOLAR',    name:'UTL Solar'                        },
  { sym:'VBL',         name:'Varun Beverages'                  },
  { sym:'VIYASH',      name:'Viyash Automation'                },
  { sym:'YASHO',       name:'Yasho Industries'                 },
  { sym:'ZELIO',       name:'Zelio Infra'                      },
  { sym:'AMIC',        name:'AMIC Ltd'                         },
];

// ── Invest 2027 Domain — separate tab + feeds CF Calendar ──────
const INVEST_DOMAIN = [
  { sym:'ABSLAMC',    name:'Aditya Birla Sun Life AMC'     },
  { sym:'ACCENTMIC',  name:'Accent Microcell'              },
  { sym:'AETHER',     name:'Aether Industries'             },
  { sym:'AIMTRON',    name:'Aimtron Electronics'           },
  { sym:'ANURAS',     name:'Anuras Tech'                   },
  { sym:'ASTEC',      name:'Astec LifeSciences'            },
  { sym:'AXISCADES',  name:'Axiscades Technologies'        },
  { sym:'AZAD',       name:'Azad Engineering'              },
  { sym:'BLACKBUCK',  name:'Zinka Logistics (BlackBuck)'   },
  { sym:'BLISSGVS',   name:'Bliss GVS Pharma'             },
  { sym:'DANISH',     name:'Danish Power'                  },
  { sym:'DATAMATICS', name:'Datamatics Global Services'    },
  { sym:'DATAPATTNS', name:'Data Patterns'                 },
  { sym:'DCMSHRIRAM', name:'DCM Shriram'                   },
  { sym:'DEEDEV',     name:'Dee Development Engineers'     },
  { sym:'DREDGECORP', name:'Dredging Corporation'          },
  { sym:'DYNAMATECH', name:'Dynamatic Technologies'        },
  { sym:'GMDCLTD',    name:'GMDC'                          },
  { sym:'GPIL',       name:'Godawari Power & Ispat'        },
  { sym:'GRWRHITECH', name:'Grauer & Weil (India)'         },
  { sym:'HAPPYFORGE', name:'Happy Forgings'                },
  { sym:'INTERARCH',  name:'Interarch Building Products'   },
  { sym:'JMFINANCIL', name:'JM Financial'                  },
  { sym:'KINGFA',     name:'Kingfa Science & Technology'   },
  { sym:'KMEW',       name:"K&M Engineering"               },
  { sym:'KOLTEPATIL', name:'Kolte-Patil Developers'        },
  { sym:'MTARTECH',   name:'MTAR Technologies'             },
  { sym:'NDRAUTO',    name:'NDR Auto Components'           },
  { sym:'NETWEB',     name:'Netweb Technologies'           },
  { sym:'NLCINDIA',   name:'NLC India'                     },
  { sym:'PFOCUS',     name:'Prime Focus'                   },
  { sym:'RAJESH',     name:'Rajesh Exports'                },
  { sym:'SANSERA',    name:'Sansera Engineering'           },
  { sym:'SHILCTECH',  name:'Shilchar Technologies'         },
  { sym:'SSEGL',      name:'SSEL Ltd'                      },
  { sym:'SSWL',       name:'Steel Strips Wheels'           },
  { sym:'STAR',       name:'Star Paper Mills'              },
  { sym:'UJJIVANSFB', name:'Ujjivan Small Finance Bank'    },
  { sym:'VALIANT',    name:'Valiant Laboratories'          },
  { sym:'VILAS',      name:'Vilas Transcore'               },
  { sym:'WHEELS',     name:'Wheels India'                  },
  { sym:'YASHHV',     name:'Yash H.V. Welding Electrodes'  },
];

// ── Read all OHLC in one Python call (CSV primary, parquet fallback) ──
function readAllOHLC(syms) {
  const tmpPy = path.join(os.tmpdir(), '_swing_rs_reader.py');
  const script = [
    'import pandas as pd, json, os, sys',
    `adj_dir      = r'${ADJ_DIR}'`,
    `processed_dir= r'${PROCESSED_DIR}'`,
    `parquet_dir  = r'${PARQUET_DIR}'`,
    `syms = ${JSON.stringify(syms)}`,
    'data = {}',
    'for sym in syms:',
    '    csv_path  = os.path.join(adj_dir,       sym + ".csv")',
    '    bhav_path = os.path.join(processed_dir, sym + ".csv")',
    '    pq_path   = os.path.join(parquet_dir,   sym + ".parquet")',
    '    def load_ts(df):',
    '        df["date"] = pd.to_datetime(df["date"], utc=False)',
    '        df["date"] = df["date"].dt.tz_localize(None)',
    '        return df',
    '    # 1) Yahoo Finance adjusted (primary historical)',
    '    df_yf = None',
    '    if os.path.exists(csv_path):',
    '        try:',
    '            d = pd.read_csv(csv_path)',
    '            d = d.rename(columns={"Date":"date","Open":"open","High":"high","Low":"low","Close":"close","Volume":"volume"})',
    '            df_yf = load_ts(d)[["date","open","high","low","close"]]',
    '        except: pass',
    '    # 2) Bhavcopy processed/ (recent days newer than Yahoo Finance)',
    '    df_bhav = None',
    '    if os.path.exists(bhav_path):',
    '        try:',
    '            d = pd.read_csv(bhav_path)',
    '            d.columns = [c.strip() for c in d.columns]',
    '            d = d.rename(columns={"Date":"date","Open":"open","High":"high","Low":"low","Close":"close","Volume":"volume","SYMBOL":"sym","Symbol":"sym"})',
    '            d = load_ts(d)[["date","open","high","low","close"]]',
    '            if df_yf is not None:',
    '                yf_last = df_yf["date"].max()',
    '                d = d[d["date"] > yf_last]',
    '            if not d.empty: df_bhav = d',
    '        except: pass',
    '    # 3) Parquet fallback (older data before Yahoo Finance)',
    '    df_pq = None',
    '    if os.path.exists(pq_path):',
    '        try:',
    '            d = pd.read_parquet(pq_path)',
    '            d = d[d["volume"] > 0]',
    '            d = load_ts(d)[["date","open","high","low","close"]]',
    '            if df_yf is not None:',
    '                yf_start = df_yf["date"].min()',
    '                d = d[d["date"] < yf_start]',
    '            if not d.empty: df_pq = d',
    '        except: pass',
    '    parts = [p for p in [df_pq, df_yf, df_bhav] if p is not None]',
    '    if not parts:',
    '        print(f"  MISSING: {sym}", file=sys.stderr)',
    '        continue',
    '    df = pd.concat(parts, ignore_index=True)',
    '    df = df.dropna(subset=["high","low"])',
    '    cutoff = pd.Timestamp("2000-01-01")',
    '    df = df[df["date"] >= cutoff]',
    '    df = df.sort_values("date").drop_duplicates("date")',
    '    rows = df[["date","open","high","low","close"]].values.tolist()',
    '    data[sym] = [[str(r[0])[:10],round(float(r[1]),2),round(float(r[2]),2),round(float(r[3]),2),round(float(r[4]),2)] for r in rows]',
    '    print(f"  {sym}: {len(data[sym])} rows ({data[sym][0][0]} -> {data[sym][-1][0]})", file=sys.stderr)',
    'print(json.dumps(data))',
  ].join('\n');
  fs.writeFileSync(tmpPy, script);
  console.error('Reading OHLC (Yahoo Finance CSV + parquet fallback)...');
  const out = execSync(`py -3 "${tmpPy}"`, { maxBuffer: 500 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

// ── Load OHLC for all unique symbols across both lists ────────
const allSyms = [...new Set([...INSTRUMENTS, ...INVEST_DOMAIN].map(i => i.sym))];
const ohlcRaw = readAllOHLC(allSyms);

const ohlcDataJS = allSyms.map(sym => {
  const rows = ohlcRaw[sym];
  if (!rows || !rows.length) return `  '${sym}':[]`;
  const encoded = rows.map(r =>
    `['${r[0]}',${r[1]},${r[2]},${r[3]},${r[4]}]`
  ).join(',');
  return `  '${sym}':[${encoded}]`;
}).join(',\n');

// ── Selector options ──────────────────────────────────────────
const instrOptions = INSTRUMENTS.map(({ sym, name }) =>
  `<option value="${sym}">${sym} — ${name}</option>`
).join('\n        ');

const investDomainOptions = INVEST_DOMAIN.map(({ sym, name }) =>
  `<option value="${sym}">${sym} — ${name}</option>`
).join('\n        ');

const instrJS        = JSON.stringify(INSTRUMENTS);
const investDomainJS = JSON.stringify(INVEST_DOMAIN);
const bestCombosJS   = fs.existsSync(BEST_COMBOS_FILE)
  ? fs.readFileSync(BEST_COMBOS_FILE, 'utf8')
  : '{}';

const yearOptions = Array.from({length:11}, (_,i) => 2020+i)
  .map(y => `<option value="${y}"${y===2026?' selected':''}>${y}</option>`).join('');

const monthOptions = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
  .map((m,i) => `<option value="${i}"${i===5?' selected':''}>${m}</option>`).join('');

// ── HTML template ─────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cash Stocks — Gann Natural Cycle</title>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<style>
:root {
  --bg:#0d1117; --panel:#161b22; --panel2:#1c2128; --border:#30363d;
  --text:#e6edf3; --sub:#8b949e; --accent:#58a6ff;
  --green:#3fb950; --red:#f85149; --orange:#e3b341; --conf:#f0883e;
  --invest:#a371f7;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;min-height:100vh}
a{color:var(--accent)}

/* ── Header ── */
.app-header{background:var(--panel);border-bottom:1px solid var(--border);padding:14px 20px 0;position:sticky;top:0;z-index:100}
.app-title{font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px}
.app-title span{font-size:12px;font-weight:400;color:var(--sub);margin-left:8px}
.tab-nav{display:flex;gap:2px;margin-top:10px}
.tab-btn{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--sub);cursor:pointer;font-size:13px;padding:8px 18px;transition:.15s}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.tab-btn.invest{color:var(--sub)}
.tab-btn.invest.active{color:var(--invest);border-bottom-color:var(--invest)}

/* ── Tab content ── */
.tab-content{display:none;padding:20px}
.tab-content.active{display:block}

/* ── Controls ── */
.ctrl-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px;margin-bottom:18px}
.ctrl{display:flex;flex-direction:column;gap:4px}
.ctrl label{color:var(--sub);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.ctrl select,.ctrl input[type=number]{background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;padding:5px 10px;outline:none}
.ctrl input[type=number]{width:100px}
.search-wrap{display:flex;align-items:flex-end;gap:6px}
.instr-search{background:var(--panel2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;padding:5px 10px;outline:none;width:140px}
.instr-search::placeholder{color:var(--sub)}
.summary-bar{display:flex;gap:20px;margin-left:auto;align-items:center}
.stat{color:var(--sub);font-size:11px}.stat span{color:var(--text);font-weight:700;margin-left:4px}
.invest-toggle{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--invest);cursor:pointer;user-select:none;border:1px solid rgba(163,113,247,.3);border-radius:5px;padding:4px 10px;background:rgba(163,113,247,.05)}
.invest-toggle input{accent-color:var(--invest)}

/* ── Legend ── */
.leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sub)}
.dot{width:8px;height:8px;border-radius:50%}

/* ── NC Table ── */
.wrap{overflow-x:auto;border-radius:8px;margin-bottom:20px}
table.nc-table{border-collapse:collapse;width:100%;min-width:900px}
.nc-table th{background:var(--panel2);color:var(--sub);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 6px;border:1px solid var(--border);text-align:center;white-space:nowrap}
.nc-table th:first-child,.nc-table th:nth-child(2){text-align:left;padding-left:12px}
.nc-table td{border:1px solid var(--border);padding:6px 5px;text-align:center;vertical-align:top}
.nc-table td:first-child{text-align:left;padding-left:12px;min-width:120px;white-space:nowrap}
.nc-table td:nth-child(2){text-align:center;color:var(--sub);font-size:11px}
.nc-table tr:hover td{background:var(--panel2)}
.yr-label{font-weight:700;margin-right:4px}
.cycle-tag{font-size:10px;color:var(--sub);background:var(--panel2);border-radius:3px;padding:1px 5px}
.conf-row td{background:rgba(240,136,62,.06)!important;font-weight:600}
.ev{display:inline-block;border-radius:4px;font-size:11px;padding:1px 5px;margin:1px;white-space:nowrap}
.ev-h{background:rgba(63,185,80,.15);color:#3fb950;border:1px solid rgba(63,185,80,.3)}
.ev-l{background:rgba(248,81,73,.15);color:#f85149;border:1px solid rgba(248,81,73,.3)}
.ev-hl{background:rgba(227,179,65,.15);color:#e3b341;border:1px solid rgba(227,179,65,.3)}

/* ── Confluence map ── */
.conf-section{margin-top:8px}
.conf-section h3{font-size:12px;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px}
.conf-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
@media(max-width:900px){.conf-grid{grid-template-columns:repeat(3,1fr)}}
.conf-month-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);margin-bottom:6px}
.conf-item{border-radius:5px;font-size:11px;font-weight:600;padding:3px 8px;margin-bottom:4px;display:flex;justify-content:space-between}
.conf-h{background:rgba(63,185,80,.12);color:#3fb950;border:1px solid rgba(63,185,80,.25)}
.conf-l{background:rgba(248,81,73,.12);color:#f85149;border:1px solid rgba(248,81,73,.25)}
.conf-hl{background:rgba(227,179,65,.12);color:#e3b341;border:1px solid rgba(227,179,65,.25)}
.conf-count{font-size:10px;opacity:.8}
.cycle-pills{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.pill{background:var(--panel2);border:1px solid var(--border);border-radius:12px;font-size:10px;color:var(--sub);padding:2px 10px}
.pill span{color:var(--accent);margin-left:3px}
.best-combo{margin-left:auto;flex-shrink:0;font-size:11px;color:var(--accent);background:rgba(88,166,255,.08);border:1px solid rgba(88,166,255,.25);border-radius:6px;padding:3px 12px;white-space:nowrap}
.legend{display:flex;gap:18px;margin-bottom:14px;flex-wrap:wrap;align-items:center}

/* ── CF Calendar ── */
.filter-strip{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;padding:10px 14px;background:var(--panel);border:1px solid var(--border);border-radius:8px}
.filter-strip label{color:var(--sub);font-size:11px;font-weight:600}
.filter-btn{background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--sub);cursor:pointer;font-size:11px;padding:4px 10px;transition:.15s}
.filter-btn:hover{border-color:var(--accent);color:var(--accent)}
.filter-btn.active{background:rgba(88,166,255,.1);border-color:var(--accent);color:var(--accent)}
.fsep{width:1px;height:18px;background:var(--border);margin:0 4px}
.view-toggle{display:flex;gap:4px}
.vtbtn{background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--sub);cursor:pointer;font-size:11px;padding:4px 10px;transition:.15s}
.vtbtn.active{background:rgba(88,166,255,.1);border-color:var(--accent);color:var(--accent)}

.date-card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px}
.date-header{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.date-num{font-size:28px;font-weight:800;color:var(--conf);min-width:42px;text-align:center}
.date-sublabel{font-size:11px;color:var(--sub);margin-top:2px}
.stock-count-badge{background:var(--panel2);border:1px solid var(--border);border-radius:12px;font-size:11px;padding:2px 10px;color:var(--sub);margin-left:auto}
.stock-count-badge.multi{background:rgba(240,136,62,.1);border-color:var(--conf);color:var(--conf)}
.stocks-grid{display:flex;flex-wrap:wrap;gap:8px}
.stock-chip{background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;min-width:130px;max-width:200px}
.chip-sym{font-weight:700;font-size:13px}
.chip-sym.h{color:#3fb950}.chip-sym.l{color:#f85149}.chip-sym.hl{color:#e3b341}
.chip-count{font-size:10px;border-radius:3px;padding:1px 4px;margin-left:4px}
.chip-count.h{background:rgba(63,185,80,.15)}.chip-count.l{background:rgba(248,81,73,.15)}.chip-count.hl{background:rgba(227,179,65,.15)}
.chip-name{color:var(--sub);font-size:10px;margin-top:2px}
.chip-meta{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}
.yr{background:var(--panel);border:1px solid var(--border);border-radius:3px;font-size:9px;padding:1px 4px;color:var(--sub)}
.chip-chart-btn{background:transparent;border:none;cursor:pointer;font-size:12px;padding:0 2px;opacity:.7;transition:.15s}
.chip-chart-btn:hover{opacity:1}
.chip-invest-tag{font-size:9px;color:var(--invest);background:rgba(163,113,247,.1);border:1px solid rgba(163,113,247,.25);border-radius:3px;padding:1px 4px;margin-left:3px}
.chip-sep{width:1px;height:14px;background:var(--border);margin:0 2px}
.chip-h{border-left:3px solid #3fb950}.chip-l{border-left:3px solid #f85149}.chip-hl{border-left:3px solid #e3b341}
.no-conf{color:var(--border);font-size:12px}

.stock-table{border-collapse:collapse;width:100%}
.stock-table th{background:var(--panel2);border:1px solid var(--border);color:var(--sub);font-size:10px;font-weight:700;letter-spacing:.5px;padding:8px 10px;text-align:left;text-transform:uppercase}
.stock-table td{border:1px solid var(--border);padding:7px 10px;vertical-align:top}
.stock-table tr:hover td{background:var(--panel2)}
.empty-state{color:var(--sub);font-size:13px;padding:40px 0;text-align:center}

/* ── Chart Modal ── */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;height:85vh;width:92vw;max-width:1400px;overflow:hidden}
.modal-hdr{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0}
.modal-sym{font-size:16px;font-weight:700}
.modal-name{font-size:11px;color:var(--sub)}
.modal-ctrls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.modal-ctrls label{color:var(--sub);font-size:11px;display:flex;align-items:center;gap:5px}
.modal-ctrls select{background:var(--panel2);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:11px;padding:3px 7px}
.modal-range-btns{display:flex;gap:4px}
.range-btn{background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--sub);cursor:pointer;font-size:11px;padding:3px 8px}
.range-btn.active{background:rgba(88,166,255,.1);border-color:var(--accent);color:var(--accent)}
.modal-close{background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--sub);cursor:pointer;font-size:16px;margin-left:auto;padding:4px 10px}
.modal-close:hover{color:var(--text);background:var(--border)}
.modal-body{flex:1;min-height:0;position:relative}
#modal-chart-container{width:100%;height:100%}
.modal-pivots{flex-shrink:0;max-height:90px;overflow-y:auto;padding:8px 16px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px}
.modal-no-data{display:flex;align-items:center;justify-content:center;height:100%;color:var(--sub);font-size:14px}
#dateView{display:flex;flex-direction:column;gap:10px}
#stockView{display:none}
</style>
</head>
<body>

<!-- Chart Modal -->
<div id="chart-modal" class="modal-overlay" onclick="if(event.target===this)closeChart()">
  <div class="modal-box">
    <div class="modal-hdr">
      <div>
        <div class="modal-sym" id="modal-sym">—</div>
        <div class="modal-name" id="modal-name">—</div>
      </div>
      <div class="modal-ctrls">
        <label>Dev%
          <select id="modal-dev" onchange="rerenderModalChart()">
            <option value="2">2%</option><option value="3">3%</option>
            <option value="4" selected>4%</option><option value="5">5%</option>
            <option value="7">7%</option><option value="10">10%</option>
          </select>
        </label>
        <label>Depth
          <select id="modal-dep" onchange="rerenderModalChart()">
            <option value="5">5</option><option value="8">8</option>
            <option value="10" selected>10</option><option value="12">12</option>
            <option value="15">15</option><option value="20">20</option>
          </select>
        </label>
        <div class="modal-range-btns">
          <button class="range-btn" onclick="setModalRange(1,this)">1Y</button>
          <button class="range-btn" onclick="setModalRange(3,this)">3Y</button>
          <button class="range-btn active" onclick="setModalRange(5,this)">5Y</button>
          <button class="range-btn" onclick="setModalRange(0,this)">All</button>
        </div>
      </div>
      <button class="modal-close" onclick="closeChart()">&#x2715;</button>
    </div>
    <div class="modal-body"><div id="modal-chart-container"></div></div>
    <div class="modal-pivots" id="modal-pivots"></div>
  </div>
</div>

<div class="app-header">
  <div class="app-title">Cash Stocks <span>Gann Natural Cycle &middot; ${INSTRUMENTS.length} main &middot; ${INVEST_DOMAIN.length} invest domain</span></div>
  <nav class="tab-nav">
    <button class="tab-btn active" onclick="switchTab('nc',this)">Natural Cycle</button>
    <button class="tab-btn" onclick="switchTab('conf',this)">Confluence Calendar</button>
    <button class="tab-btn invest" onclick="switchTab('id',this)">&#x1F4C8; Invest Domain</button>
  </nav>
</div>

<!-- TAB 1: Natural Cycle -->
<div id="tab-nc" class="tab-content active">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Instrument</label>
      <div class="search-wrap">
        <select id="nc-instr" onchange="ncOnInstrChange()" size="1" style="min-width:220px">
          ${instrOptions}
        </select>
        <input type="text" class="instr-search" id="nc-search" placeholder="Search..." oninput="ncFilterInstr(this.value,'nc-instr')">
      </div>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <input type="number" id="nc-year" value="2026" min="2000" max="2050" oninput="ncRender()">
    </div>
    <div class="ctrl">
      <label>ZigZag Dev%</label>
      <select id="nc-dev" onchange="invalidateCache();ncRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Depth</label>
      <select id="nc-dep" onchange="invalidateCache();ncRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <label class="invest-toggle" title="Add Invest Domain stocks to dropdown">
      <input type="checkbox" id="nc-invest-toggle" onchange="toggleNCInvest()">
      Invest Domain
    </label>
    <button style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--sub);cursor:pointer;padding:5px 12px;font-size:12px;align-self:flex-end" onclick="openChartFromNC()" title="Open ZigZag chart">&#x1F4C8; Chart</button>
    <div class="cycle-pills" id="nc-pills"></div>
  </div>
  <div class="legend">
    <div class="leg"><div class="dot" style="background:var(--green)"></div> High (H)</div>
    <div class="leg"><div class="dot" style="background:var(--red)"></div> Low (L)</div>
    <div class="leg"><div class="dot" style="background:var(--orange)"></div> High + Low same date</div>
    <div class="leg"><div class="dot" style="background:var(--conf)"></div> Confluence (&#x2265;2 years)</div>
    <span id="nc-best-combo" class="best-combo" style="display:none"></span>
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
    <h3>&#x26A1; Confluence Map &mdash; Dates appearing in &#x2265;2 Gann cycle years</h3>
    <div class="conf-grid" id="nc-conf-grid"></div>
  </div>
</div>

<!-- TAB 2: Confluence Calendar -->
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
      <label>ZigZag Dev%</label>
      <select id="cf-dev" onchange="invalidateCache();cfRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Depth</label>
      <select id="cf-dep" onchange="invalidateCache();cfRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <label class="invest-toggle" style="align-self:flex-end" title="Include Invest Domain stocks in calendar">
      <input type="checkbox" id="cf-invest-toggle" onchange="cfRender()">
      Invest Domain
    </label>
    <div class="summary-bar">
      <div class="stat">Dates <span id="cf-stat-dates">—</span></div>
      <div class="stat">Stocks <span id="cf-stat-stocks">—</span></div>
      <div class="stat">Multi-stock <span id="cf-stat-multi">—</span></div>
    </div>
  </div>
  <div class="filter-strip">
    <label>Min stocks per date:</label>
    <button class="filter-btn active" onclick="cfSetMin(1,this)">Any (&#x2265;1)</button>
    <button class="filter-btn" onclick="cfSetMin(2,this)">&#x2265;2</button>
    <button class="filter-btn" onclick="cfSetMin(3,this)">&#x2265;3</button>
    <button class="filter-btn" onclick="cfSetMin(4,this)">&#x2265;4</button>
    <div class="fsep"></div>
    <div class="view-toggle">
      <button class="vtbtn active" onclick="cfSetView('date',this)">By Date</button>
      <button class="vtbtn" onclick="cfSetView('stock',this)">By Stock</button>
    </div>
  </div>
  <div id="dateView"></div>
  <div id="stockView">
    <table class="stock-table">
      <thead><tr><th>Stock</th><th>Name</th><th>Confluence Dates</th><th>Lookback Years</th></tr></thead>
      <tbody id="cf-stock-tbody"></tbody>
    </table>
  </div>
</div>

<!-- TAB 3: Invest Domain -->
<div id="tab-id" class="tab-content">
  <div class="ctrl-row">
    <div class="ctrl">
      <label>Instrument</label>
      <div class="search-wrap">
        <select id="id-instr" onchange="idOnInstrChange()" size="1" style="min-width:220px">
          ${investDomainOptions}
        </select>
        <input type="text" class="instr-search" id="id-search" placeholder="Search..." oninput="ncFilterInstr(this.value,'id-instr')">
      </div>
    </div>
    <div class="ctrl">
      <label>Analysis Year</label>
      <input type="number" id="id-year" value="2026" min="2000" max="2050" oninput="idRender()">
    </div>
    <div class="ctrl">
      <label>ZigZag Dev%</label>
      <select id="id-dev" onchange="invalidateCache();idRender()">
        <option value="2">2%</option><option value="3">3%</option>
        <option value="4" selected>4%</option><option value="5">5%</option>
        <option value="7">7%</option><option value="10">10%</option>
      </select>
    </div>
    <div class="ctrl">
      <label>Depth</label>
      <select id="id-dep" onchange="invalidateCache();idRender()">
        <option value="5">5</option><option value="8">8</option>
        <option value="10" selected>10</option><option value="12">12</option>
        <option value="15">15</option><option value="20">20</option>
      </select>
    </div>
    <button style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--sub);cursor:pointer;padding:5px 12px;font-size:12px;align-self:flex-end" onclick="openChartFromID()" title="Open ZigZag chart">&#x1F4C8; Chart</button>
    <div class="cycle-pills" id="id-pills"></div>
  </div>
  <div class="legend">
    <div class="leg"><div class="dot" style="background:var(--green)"></div> High (H)</div>
    <div class="leg"><div class="dot" style="background:var(--red)"></div> Low (L)</div>
    <div class="leg"><div class="dot" style="background:var(--orange)"></div> High + Low same date</div>
    <div class="leg"><div class="dot" style="background:var(--conf)"></div> Confluence (&#x2265;2 years)</div>
    <span id="id-best-combo" class="best-combo" style="display:none"></span>
  </div>
  <div class="wrap">
    <table class="nc-table">
      <thead><tr>
        <th>Year (Cycle)</th><th>Gap</th>
        <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
        <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
      </tr></thead>
      <tbody id="id-tbody"></tbody>
    </table>
  </div>
  <div class="conf-section">
    <h3>&#x26A1; Confluence Map &mdash; Dates appearing in &#x2265;2 Gann cycle years</h3>
    <div class="conf-grid" id="id-conf-grid"></div>
  </div>
</div>

<script>
const INSTRUMENTS   = ${instrJS};
const INVEST_DOMAIN = ${investDomainJS};
const BEST_COMBOS   = ${bestCombosJS};
const ALL_INSTR_MAP = {};
[...INSTRUMENTS,...INVEST_DOMAIN].forEach(i=>ALL_INSTR_MAP[i.sym]=i.name);

const OHLC_DATA = {
${ohlcDataJS}
};
const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const GAPS        = [20,15,13,12,10,6,5,4,3,2,1];

// ── ZigZag engine ─────────────────────────────────────────────
function computeZigZag(rows, dev, dep) {
  const pivots = [];
  if (!rows || !rows.length) return pivots;
  let trend=null, lhP=rows[0][2], lhD=rows[0][0], lhI=0, llP=rows[0][3], llD=rows[0][0], llI=0;
  for (let i=1;i<rows.length;i++) {
    const date=rows[i][0], high=rows[i][2], low=rows[i][3];
    if (trend===null||trend==='UP') {
      if (high>=lhP){lhP=high;lhD=date;lhI=i;}
      if (low<=lhP*(1-dev/100)&&(i-lhI)>=dep){
        pivots.push({date:lhD,type:'H',price:lhP});
        trend='DOWN';
        llP=low;llD=date;llI=i;
        for(let j=lhI+1;j<=i;j++){if(rows[j][3]<llP){llP=rows[j][3];llD=rows[j][0];llI=j;}}
      }
    }
    if (trend==='DOWN') {
      if (low<=llP){llP=low;llD=date;llI=i;}
      if (high>=llP*(1+dev/100)&&(i-llI)>=dep){
        pivots.push({date:llD,type:'L',price:llP});
        trend='UP';
        lhP=high;lhD=date;lhI=i;
        for(let j=llI+1;j<=i;j++){if(rows[j][2]>lhP){lhP=rows[j][2];lhD=rows[j][0];lhI=j;}}
      }
    }
  }
  if(trend==='UP')pivots.push({date:lhD,type:'H',price:lhP});
  else if(trend==='DOWN')pivots.push({date:llD,type:'L',price:llP});
  return pivots;
}

let _cache = null;
function invalidateCache(){_cache=null;}

function getZZMatrix(sym, dev, dep) {
  if(!_cache)_cache={};
  const key=sym+'|'+dev+'|'+dep;
  if(_cache[key])return _cache[key];
  const pivots=computeZigZag(OHLC_DATA[sym],dev,dep);
  const matrix={};
  pivots.forEach(({date,type})=>{
    const yr=parseInt(date.substring(0,4));
    const mi=parseInt(date.substring(5,7))-1;
    const dd=date.substring(8,10);
    if(!matrix[yr])matrix[yr]=Array.from({length:12},()=>[]);
    matrix[yr][mi].push({day:dd,type});
  });
  _cache[key]=matrix;
  return matrix;
}

function getYearRow(sym, year, dev, dep) {
  const m=getZZMatrix(sym,dev,dep);
  const yd=m[year];
  if(!yd)return Array(12).fill('');
  return yd.map(entries=>{
    if(!entries||!entries.length)return '';
    return entries.sort((a,b)=>+a.day-+b.day).map(e=>e.day+' '+e.type).join(' / ');
  });
}

function extractDates(val) {
  const r=[];
  val.split(/\\s*\\/\\s*/).forEach(p=>{
    const m=p.trim().match(/^(\\d{1,2})\\s*([HL])/i);
    if(m)r.push({day:m[1].padStart(2,'0'),type:m[2].toUpperCase()});
  });
  return r;
}

function classify(val) {
  if(!val)return 'empty';
  const h=/H/i.test(val),l=/L/i.test(val);
  return(h&&l)?'hl':h?'h':l?'l':'empty';
}

function cellHTML(val) {
  if(!val)return '';
  return val.split(/\\s*\\/\\s*/).map(p=>{
    p=p.trim();
    const t=classify(p);
    const cls=t==='h'?'ev-h':t==='l'?'ev-l':t==='hl'?'ev-hl':'';
    return cls?\`<span class="ev \${cls}">\${p}</span>\`:\`<span>\${p}</span>\`;
  }).join('<br>');
}

function cfLookbackCount(sym, analysisYear, dev, dep) {
  const matrix = getZZMatrix(sym, dev, dep);
  return GAPS.filter(g => matrix[analysisYear - g] !== undefined).length;
}

function cfGetConfluence(sym, analysisYear, monthIdx, dev, dep) {
  const lookbackYears=GAPS.map(g=>analysisYear-g);
  const freq={};
  const matrix=getZZMatrix(sym,dev,dep);
  lookbackYears.forEach(yr=>{
    const yd=matrix[yr];if(!yd||!yd[monthIdx])return;
    yd[monthIdx].forEach(({day,type})=>{
      if(!freq[day])freq[day]=[];
      freq[day].push({year:yr,type});
    });
  });
  const result={};
  for(const[day,arr]of Object.entries(freq)){if(arr.length>=2)result[day]=arr;}
  return result;
}

function cfChipCls(arr){
  const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
  return(h&&l)?'hl':h?'h':'l';
}

// ── Search filter ─────────────────────────────────────────────
function ncFilterInstr(q, selectId) {
  const val = q.toLowerCase().trim();
  Array.from(document.getElementById(selectId).options).forEach(opt => {
    opt.hidden = val ? (!opt.value.toLowerCase().includes(val) && !opt.text.toLowerCase().includes(val)) : false;
  });
}

// ── Invest Domain toggle in NC Tab 1 ─────────────────────────
function toggleNCInvest() {
  const checked = document.getElementById('nc-invest-toggle').checked;
  const sel = document.getElementById('nc-instr');
  const existing = new Set(Array.from(sel.options).map(o=>o.value));
  if (checked) {
    INVEST_DOMAIN.forEach(({sym,name}) => {
      if (!existing.has(sym)) {
        const opt = document.createElement('option');
        opt.value = sym;
        opt.text  = sym + ' — ' + name;
        opt.dataset.invest = '1';
        sel.appendChild(opt);
      }
    });
  } else {
    Array.from(sel.options).forEach(opt => {
      if (opt.dataset.invest === '1') opt.remove();
    });
  }
  // re-apply current search
  const q = document.getElementById('nc-search').value;
  if (q) ncFilterInstr(q, 'nc-instr');
}

// ── Chart Modal ───────────────────────────────────────────────
let _modalChart=null, _modalSym=null, _modalRange=5;

function openChart(sym, name, dev, dep) {
  _modalSym=sym;
  document.getElementById('modal-sym').textContent=sym;
  document.getElementById('modal-name').textContent=name||ALL_INSTR_MAP[sym]||'';
  document.getElementById('modal-dev').value=dev;
  document.getElementById('modal-dep').value=dep;
  document.getElementById('chart-modal').classList.add('open');
  document.body.style.overflow='hidden';
  renderModalChart();
}

function openChartFromNC() {
  const sym=document.getElementById('nc-instr').value;
  const dev=parseFloat(document.getElementById('nc-dev').value);
  const dep=parseInt(document.getElementById('nc-dep').value);
  openChart(sym,ALL_INSTR_MAP[sym]||'',dev,dep);
}

function openChartFromID() {
  const sym=document.getElementById('id-instr').value;
  const dev=parseFloat(document.getElementById('id-dev').value);
  const dep=parseInt(document.getElementById('id-dep').value);
  openChart(sym,ALL_INSTR_MAP[sym]||'',dev,dep);
}

function closeChart() {
  document.getElementById('chart-modal').classList.remove('open');
  document.body.style.overflow='';
  if(_modalChart){_modalChart.remove();_modalChart=null;}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChart();});

function rerenderModalChart(){renderModalChart();}

function setModalRange(years,btn){
  _modalRange=years;
  document.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyModalRange();
}

function applyModalRange(){
  if(!_modalChart)return;
  if(_modalRange===0){_modalChart.timeScale().fitContent();return;}
  const now=new Date(), from=new Date(now);
  from.setFullYear(from.getFullYear()-_modalRange);
  _modalChart.timeScale().setVisibleRange({from:from.toISOString().substring(0,10),to:now.toISOString().substring(0,10)});
}

function renderModalChart() {
  const sym=_modalSym;
  const dev=parseFloat(document.getElementById('modal-dev').value);
  const dep=parseInt(document.getElementById('modal-dep').value);
  const container=document.getElementById('modal-chart-container');
  if(_modalChart){_modalChart.remove();_modalChart=null;}
  const rows=OHLC_DATA[sym];
  if(!rows||!rows.length){
    container.innerHTML=\`<div class="modal-no-data">No data for \${sym}</div>\`;return;
  }
  _modalChart=LightweightCharts.createChart(container,{
    width:container.clientWidth,height:container.clientHeight,
    layout:{background:{type:'solid',color:'#0d1117'},textColor:'#c9d1d9'},
    grid:{vertLines:{color:'#21262d'},horzLines:{color:'#21262d'}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
    rightPriceScale:{borderColor:'#30363d',scaleMargins:{top:.08,bottom:.08}},
    timeScale:{borderColor:'#30363d',timeVisible:false},
  });
  const candles=_modalChart.addCandlestickSeries({
    upColor:'#3fb950',downColor:'#f85149',borderVisible:false,
    wickUpColor:'#3fb950',wickDownColor:'#f85149',
  });
  candles.setData(rows.map(r=>({time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]})));
  const pivots=computeZigZag(rows,dev,dep);
  if(pivots.length>1){
    const zigzag=_modalChart.addLineSeries({color:'#e3b341',lineWidth:2,lastValueVisible:false,priceLineVisible:false});
    zigzag.setData(pivots.map(p=>({time:p.date,value:p.price})));
  }
  const pivEl=document.getElementById('modal-pivots');
  const recent=[...pivots].reverse().slice(0,20);
  pivEl.innerHTML=recent.map(p=>{
    const cls=p.type==='H'?'ev-h':'ev-l';
    return\`<span class="ev \${cls}">\${p.date} \${p.type} \${p.price.toFixed(2)}</span>\`;
  }).join('');
  applyModalRange();
}

// ── Tab switching ─────────────────────────────────────────────
let _activeTab='nc';
function switchTab(id,btn){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-'+id).classList.add('active');
  _activeTab=id;
  if(id==='nc')ncRender();
  else if(id==='conf')cfRender();
  else if(id==='id')idRender();
}

// ── Shared NC render logic ────────────────────────────────────
function renderNCTable(sym, dev, dep, yr, tbodyId, gridId, pillsId) {
  const years=GAPS.map(g=>({gap:g,year:yr-g}));

  document.getElementById(pillsId).innerHTML=years.map(({gap,year})=>
    \`<div class="pill">\${year} <span>(−\${gap}yr)</span></div>\`).join('');

  const freq=MONTHS.map(()=>({}));
  years.forEach(({year})=>{
    getYearRow(sym,year,dev,dep).forEach((val,mi)=>{
      if(!val)return;
      extractDates(val).forEach(({day,type})=>{
        if(!freq[mi][day])freq[mi][day]=[];
        freq[mi][day].push({year,type});
      });
    });
  });

  const tbody=document.getElementById(tbodyId);
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
  confTr.innerHTML=\`<td>&#x26A1; Confluence<br><span style="font-size:10px;color:var(--sub)">≥2 years</span></td><td>—</td>\`;
  MONTHS.forEach((_,mi)=>{
    const cd=Object.entries(freq[mi]).filter(([,a])=>a.length>=2).sort((a,b)=>b[1].length-a[1].length);
    if(!cd.length){confTr.innerHTML+='<td></td>';return;}
    confTr.innerHTML+=\`<td>\${cd.map(([day,arr])=>{
      const hh=arr.some(e=>e.type==='H'),ll=arr.some(e=>e.type==='L');
      const cls=(hh&&ll)?'ev-hl':hh?'ev-h':'ev-l';
      const lbl=(hh&&ll)?\`\${day} H/L\`:hh?\`\${day} H\`:\`\${day} L\`;
      const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
      return\`<span class="ev \${cls}" title="\${tip}">&#x26A1;\${lbl} \xd7\${arr.length}</span>\`;
    }).join('<br>')}</td>\`;
  });
  tbody.appendChild(confTr);

  const grid=document.getElementById(gridId);
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
        return\`<div class="conf-item \${cls}" title="\${tip}">\${lbl} <span class="conf-count">\xd7\${arr.length}</span></div>\`;
      }).join('')
    );
    grid.appendChild(div);
  });
}

// ── Best combo badge ──────────────────────────────────────────
function showBestCombo(sym, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const bc = BEST_COMBOS[sym];
  if (!bc) { el.style.display = 'none'; return; }
  el.textContent = \`Best: Dev \${bc.dev}% · Depth \${bc.dep}   \${bc.n}T · \${bc.w}%W\`;
  el.style.display = 'inline-block';
}

// ── TAB 1: Natural Cycle ──────────────────────────────────────
function ncOnInstrChange(){
  invalidateCache();
  showBestCombo(document.getElementById('nc-instr').value, 'nc-best-combo');
  ncRender();
}

function ncRender(){
  const yr=parseInt(document.getElementById('nc-year').value);
  if(!yr||yr<2000||yr>2100)return;
  const sym=document.getElementById('nc-instr').value;
  const dev=parseFloat(document.getElementById('nc-dev').value);
  const dep=parseInt(document.getElementById('nc-dep').value);
  renderNCTable(sym,dev,dep,yr,'nc-tbody','nc-conf-grid','nc-pills');
}

// ── TAB 3: Invest Domain ──────────────────────────────────────
function idOnInstrChange(){
  invalidateCache();
  showBestCombo(document.getElementById('id-instr').value, 'id-best-combo');
  idRender();
}

function idRender(){
  const yr=parseInt(document.getElementById('id-year').value);
  if(!yr||yr<2000||yr>2100)return;
  const sym=document.getElementById('id-instr').value;
  const dev=parseFloat(document.getElementById('id-dev').value);
  const dep=parseInt(document.getElementById('id-dep').value);
  renderNCTable(sym,dev,dep,yr,'id-tbody','id-conf-grid','id-pills');
}

// ── TAB 2: Confluence Calendar ────────────────────────────────
let _cfMin=1, _cfView='date';

function cfGetActiveList() {
  const includeInvest = document.getElementById('cf-invest-toggle').checked;
  if (!includeInvest) return INSTRUMENTS;
  const mainSyms = new Set(INSTRUMENTS.map(i=>i.sym));
  return [...INSTRUMENTS, ...INVEST_DOMAIN.filter(i=>!mainSyms.has(i.sym))];
}

function cfRender(){
  const monthIdx=parseInt(document.getElementById('cf-month').value);
  const year=parseInt(document.getElementById('cf-year').value);
  const dev=parseFloat(document.getElementById('cf-dev').value);
  const dep=parseInt(document.getElementById('cf-dep').value);
  const activeList=cfGetActiveList();

  const dateMap={}, stockConf={};
  const stocksWithSignal=new Set();

  activeList.forEach(({sym,name})=>{
    if(cfLookbackCount(sym,year,dev,dep)<3)return;
    const conf=cfGetConfluence(sym,year,monthIdx,dev,dep);
    if(!Object.keys(conf).length)return;
    const isInvest=!INSTRUMENTS.some(i=>i.sym===sym);
    stockConf[sym]={name,conf,isInvest};
    stocksWithSignal.add(sym);
    for(const[day,arr]of Object.entries(conf)){
      if(!dateMap[day])dateMap[day]=[];
      dateMap[day].push({sym,name,arr,isInvest});
    }
  });

  const sortedDays=Object.keys(dateMap).sort();
  const multiDays=sortedDays.filter(d=>dateMap[d].length>=2);

  document.getElementById('cf-stat-dates').textContent=sortedDays.length;
  document.getElementById('cf-stat-stocks').textContent=stocksWithSignal.size;
  document.getElementById('cf-stat-multi').textContent=multiDays.length;

  const filtered=sortedDays.filter(d=>dateMap[d].length>=_cfMin);
  if(_cfView==='date')cfRenderDate(filtered,dateMap,monthIdx,year,dev,dep);
  else cfRenderStock(stockConf,activeList,monthIdx,year);
}

function cfRenderDate(days,dateMap,monthIdx,year,dev,dep){
  const el=document.getElementById('dateView');
  const monthName=MONTHS_LONG[monthIdx];
  if(!days.length){
    el.innerHTML=\`<div class="empty-state">No confluence dates for <strong>\${monthName} \${year}</strong> with current filters.</div>\`;
    return;
  }
  el.innerHTML=days.map(day=>{
    const stocks=dateMap[day];
    const isMulti=stocks.length>=2;
    const chips=stocks.sort((a,b)=>b.arr.length-a.arr.length).map(({sym,name,arr,isInvest})=>{
      const cls=cfChipCls(arr);
      const yrs=arr.map(e=>\`<span class="yr">\${e.year}:\${e.type}</span>\`).join('');
      const investTag=isInvest?\`<span class="chip-invest-tag">Invest</span>\`:'';
      const chartBtn=\`<button class="chip-chart-btn" onclick="openChart('\${sym}','\${(name||'').replace(/'/g,"\\\\'")}',\${dev},\${dep})">&#x1F4C8;</button>\`;
      return\`<div class="stock-chip chip-\${cls}">
        <div style="display:flex;align-items:center;justify-content:space-between">\${chartBtn}<div class="chip-sym \${cls}" style="flex:1">\${sym} <span class="chip-count \${cls}">\xd7\${arr.length}</span>\${investTag}</div></div>
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

function cfRenderStock(stockConf,activeList,monthIdx,year){
  const tbody=document.getElementById('cf-stock-tbody');
  const monthName=MONTHS_LONG[monthIdx];
  if(!Object.keys(stockConf).length){
    tbody.innerHTML=\`<tr><td colspan="4" class="empty-state">No confluence dates for \${monthName} \${year}.</td></tr>\`;
    return;
  }
  tbody.innerHTML=activeList.map(({sym,name})=>{
    const sc=stockConf[sym];
    if(!sc){
      if(_cfMin>1)return '';
      return\`<tr><td>\${sym}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td colspan="2" class="no-conf">—</td></tr>\`;
    }
    const days=Object.keys(sc.conf).sort();
    const badges=days.map(day=>{
      const arr=sc.conf[day];
      const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
      const cls=(h&&l)?'ev-hl':h?'ev-h':'ev-l';
      const lbl=day+' '+((h&&l)?'H/L':h?'H':'L');
      const tip=arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
      return\`<span class="ev \${cls}" title="\${tip}">&#x26A1; \${lbl} \xd7\${arr.length}</span>\`;
    }).join(' ');
    const yrs=[...new Set(days.flatMap(d=>sc.conf[d].map(e=>e.year)))].sort().join(', ');
    const investTag=sc.isInvest?\`<span class="chip-invest-tag">Invest</span>\`:'';
    return\`<tr><td>\${sym}\${investTag}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td>\${badges}</td><td style="color:var(--sub);font-size:11px">\${yrs}</td></tr>\`;
  }).filter(Boolean).join('');
}

function cfSetMin(n,btn){
  _cfMin=n;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  cfRender();
}
function cfSetView(v,btn){
  _cfView=v;
  document.querySelectorAll('.vtbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dateView').style.display=v==='date'?'flex':'none';
  document.getElementById('stockView').style.display=v==='stock'?'block':'none';
  cfRender();
}

// ── Init ──────────────────────────────────────────────────────
showBestCombo(document.getElementById('nc-instr').value, 'nc-best-combo');
ncRender();
</script>
</body>
</html>`;

fs.writeFileSync(OUT_FILE, html, 'utf8');
const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
console.error(`Done. swing_rs.html — ${size} MB`);
