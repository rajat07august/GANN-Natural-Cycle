# Gann Cycle Dashboard — Project Notes

## Working Directory
`j:\GANN Claude\`

## Vercel URLs
- **NIFTY50 Dashboard:** https://gann-natural-cycle.vercel.app
- **Cash Stocks Dashboard:** https://cash-stocks-gann.vercel.app

## Source Files (do not modify)
- `Gann/6/1/Natural Cycle.xlsx` — 48 sheets. NIFTY_F (1995–2025), BANKNIFTY_F (2005–2023), FINNIFTY (2012–2023), TCS, ~20 other stocks.
- `Gann/6/1/Dynamic Cycle_.xlsm` — 74 sheets. HOLIDAYS sheet, 70+ NSE instrument sheets, RESULT sheet (6112 rows).
- `Dataset/NIFTY50_all.csv` — OHLC for NIFTY50 stocks, 2007–2021. Used as source 1 for historical data.

## OHLC Data Sources

### Main Dashboard (trial_natural_cycle.html)
- **Source 1:** `Dataset/NIFTY50_all.csv` (2007–2021, NIFTY50 stocks + old NSE names)
- **Source 2:** `j:/Swing Trading/Swing Trading/processed/SYMBOL.csv` (2020–2026, bhavcopy daily)
- **Source 3:** `j:/Swing Trading/Swing Trading/processed_adj/SYMBOL.csv` (Yahoo Finance adjusted, 2000–2026) — primary for main dashboard; fetched by `fetch_adjusted.js`
- Merged in `build_trial.js` → `mergeRows(sym)` deduplicates by date, sorts chronologically
- Historical NSE name mapping: HINDLEVER→HINDUNILVR, BHARTI→BHARTIARTL, INFOSYSTCH→INFY, JSWSTL→JSWSTEEL, HINDALC0→HINDALCO, TISCO→TATASTEEL, TELCO→TATAMOTORS, UTIBANK→AXISBANK, KOTAKMAH→KOTAKBANK, HEROHONDA→HEROMOTOCO, BAJAUTOFIN→BAJFINANCE

### Cash Stocks Dashboard (swing_rs.html)
- **Source:** `j:/Swing Trading/Swing Trading/processed_adj_cash/SYMBOL.csv` (Yahoo Finance adjusted) — fetched by `fetch_cash_ohlc.js`

## Output Files
- `Gann/6/trial_natural_cycle.html` — **Main NIFTY50 dashboard (~20 MB).** Two-tab layout. Rebuilt by `node build_trial.js`.
- `Gann/6/swing_rs.html` — **Cash Stocks dashboard (~36 MB).** Two-tab layout. Rebuilt by `node build_swing_rs.js`.
- `Gann/reports/` — 49 individual ZigZag candlestick chart HTMLs + index.html. Rebuilt by `node build_chart.js`.
- `Gann/6/Gann_Cycle_Dashboard.html` — First-gen dashboard (legacy, not actively maintained).

## Build Scripts
- `build_trial.js` — Builds `trial_natural_cycle.html`. Loads OHLC for all instruments, embeds data, generates two-tab HTML. Embeds `Backtest/best_combos_main.json` for legend strip badges.
- `build_swing_rs.js` — Builds `swing_rs.html`. Cash stocks dashboard. Embeds `Backtest/best_combos_cash.json` for legend strip badges.
- `fetch_adjusted.js` — Fetches Yahoo Finance adjusted OHLC → `processed_adj/`. Covers 84 symbols (NIFTY50 + main dashboard midcap).
- `fetch_cash_ohlc.js` — Fetches Yahoo Finance adjusted OHLC → `processed_adj_cash/`. Covers ~300 cash stock symbols. BSE-only tickers handled via `YF_OVERRIDES` (e.g. GVTD→`GVT%26D.NS`, JKBANK→`J%26KBANK.NS`, ZELIO→`ZELIO.BO`).
- `build_chart.js` — Builds per-stock ZigZag chart HTMLs into `Gann/reports/`.
- `update_data.js` — Daily bhavcopy updater. Steps: bhavcopy → processed CSVs → YF main (fetch_adjusted.js) → YF cash (fetch_cash_ohlc.js) → Kite gap fill (fill_gaps_kite.js) → Kite intraday → rebuild HTMLs. Tracks ~300 symbols total. Needs a fresh Kite token each day (`node fetch_intraday_kite.js --login`).
- `fill_gaps_kite.js` — Appends Kite daily candles to `processed_adj/` and `processed_adj_cash/` CSVs that lag the latest trading date (Yahoo partial null-close rows; SME/BSE stocks Yahoo lacks). Resolves NSE `-SM/-ST/-BE/-BZ` series and BSE; renamed tickers via `KITE_ALIASES` (HEG→HEGAM).
- `build_confluence.js` — Standalone confluence HTML (superseded by Tab 2 in trial_natural_cycle.html).
- `zigzag_monthly.js` — CLI: `node zigzag_monthly.js SYMBOL src.csv` → monthly pivot matrix.
- `extract_ohlc.js` — CLI: outputs compact `[date, high, low]` arrays.

## Natural Cycle Data Format
Each sheet (e.g. NIFTY_F) is a Year × Month matrix.
Cell values like `"08 H"`, `"14 L"`, `"08 H / 14 L"` = day-of-month + High/Low marker.

## Gann Cycle Gaps
11 lookback intervals from analysis year: −1, −2, −3, −4, −5, −6, −10, −12, −13, −15, −20

## Confluence Rule
Same calendar day appearing in ≥2 of the 11 lookback years in the same month = confluence signal.
**Key:** group by day number ONLY — H and L on the same day count as one confluence (don't split by type).

## ZigZag Indicator
- Deviation: 4%, Depth: 10 bars (default) — matches TradingView "Zig Zag 4 10" and hand-curated NIFTY_F data.
- Deviation and Depth are user-adjustable via dropdowns in both tabs.
- Algorithm: tracks swing H and L, confirms reversal when price moves dev% in opposite direction with ≥dep bars gap.
- Pivots stored as `{date, type, price}` — price added for chart modal rendering.

## trial_natural_cycle.html — Current State (APPROVED)
**Tab 1 — Natural Cycle:**
- Instrument selector: NIFTY50 optgroup (always) + Midcap/Smallcap optgroup (shown when checkbox ticked)
- Analysis year input (default 2026), ZigZag dev%/depth controls
- Table: 11 Gann lookback rows + confluence row + confluence map panel below
- NIFTY_F data (1995–2025) hand-curated, embedded as JS object — bypasses ZigZag
- All other instruments use ZigZag computed from OHLC_DATA
- Legend strip shows best combo badge (Dev%/Depth, trades, win%) from `best_combos_main.json`

**Tab 2 — Confluence Calendar:**
- Month + Year dropdowns, ZigZag params, stats bar
- Filter by min stocks per date (Any / ≥2 / ≥3 / ≥4)
- View toggle: By Date (date cards with stock chips) / By Stock (table)
- "Midcap / Smallcap Stocks" checkbox (header) — toggles inclusion of midcap stocks in both tabs

**Chart Modal:**
- Opens via 📈 button in NC tab controls (current instrument) or 📈 icon on CF stock chips
- Shows ZigZag swing line (amber) with H/L price markers
- Controls: Dev%, Depth, range buttons (1Y / 3Y / 5Y / All)
- Pivot strip at bottom (recent pivots, reverse chronological)
- Close: ✕ button, Escape key, or click backdrop

## swing_rs.html — Cash Stocks Dashboard
- Tab 1 — Swing RS (relative strength / natural cycle table per stock)
- Tab 2 — Confluence Calendar (same CF calendar logic as main dashboard)
- **CF lookback filter:** stocks with fewer than 3 of the 11 Gann lookback years having pivot data are excluded from the CF calendar (`cfLookbackCount() < 3` check in `cfRender()`). Prevents very recent IPOs from cluttering signals.
- Legend strip shows best combo badge from `best_combos_cash.json`
- INVEST_DOMAIN — separate "Invest 2027" subset shown in a secondary toggle

## Instruments

### Main Dashboard — NIFTY50 (51 with index)
NIFTY (index, uses NIFTY_F) + NIFTY50 constituents (ZOMATO and TATAMOTORS removed 2026-10-22 — renamed/demerged, no longer on Yahoo/Kite)
- Data coverage: most from 2000, newer additions from 2020 (ADANIENT, APOLLOHOSP, HDFCLIFE, TRENT, TATACONSUM)
- SHRIRAMFIN from 2022

### Main Dashboard — Extended Midcap (35 stocks)
Original 25 FNO: ADANIPOWER, POONAWALLA, SUZLON, FEDERALBNK, PERSISTENT, COFORGE, CANBK, SAIL, NMDC, RVNL, IRFC, MCX, NATIONALUM, INDHOTEL, LTTS, MFSL, HUDCO, SRF, POLYCAB, NHPC, SJVN, CONCOR, COCHINSHIP, MAZDOCK

Added later: BHEL, BANDHANBNK, BANKBARODA, BANKINDIA, CUB, DHANBANK, RBLBANK, DLF, OBEROIRLTY, GODREJPROP
- Data coverage: Jan 2020 → 2026. Only 3–6 of 11 Gann lookback years will have pivots.
- GMRINFRA removed 2026-10-22 (delisted/renamed).
- NOTE: POONAWALLAFIN = NSE ticker POONAWALLA

### Cash Stocks Dashboard (~300 symbols)
All stocks in `fetch_cash_ohlc.js` ALL_SYMS. Includes the ~216 original stocks plus 84 added 2026-07-01 from watchlists:
- Banks: BANDHANBNK, BANKINDIA, CUB, DHANBANK, JKBANK, MAHABANK
- Infra/Real Estate: BRIGADE, ENGINERSIN, LODHA, MAXESTATES, RAYMONDREL, AEGISLOG
- New-age/IPO: ATHERENERG, OLAELEC, NAZARA, RATEGAIN, SHADOWFAX, ETERNAL, CARTRADE
- Chemicals/Pharma: HSCL, SUVEN, SUPRIYA, BALAMINES, SASKEN, SOTL, SHREEPUSHK
- Industrial: NRBBEARING, TALBROAUTO, GABRIEL, VBL, TEJASNET, RAMCOSYS, SEDEMAC
- PSU/Shipping: COCHINSHIP, INDHOTEL, SOLARINDS, ADANIPORTS

## Known Bugs Fixed
- Confluence tab "By Date" view was blank — `dev` and `dep` not passed to `cfRenderDate()`. Fixed.
- OHLC_DATA keys with special chars (M&M, BAJAJ-AUTO) must be quoted: `'${sym}':` not `${sym}:`.
- Confluence grouping: group by day-only, not day+type (H and L on same date = one signal).

## Backtest Scripts (Backtest/ folder — outputs excluded from git)

### Main Dashboard Backtest (`backtest_main_sweep.js`)
- Sweeps Dev% ∈ {2,3,4,5,7,10} × Depth ∈ {5,8,10,12,15,20} = 36 combos per stock
- Reads from `processed_adj/` (Yahoo Finance adjusted). Covers 92 symbols.
- Output: `best_combos_main.json` (91 stocks, format: `{"SYM": {"dev":N,"dep":N,"n":N,"w":N.N}}`)
- `YEAR_START=2000`, `MIN_TRADES=10`, selects best Calmar ratio combo per stock
- Top results: MFSL 47.5, BAJFINANCE 35.91, TRENT 30.78, SOLARINDS 28.79, COCHINSHIP 25.82

### Cash Stocks Backtest (`backtest_cash_sweep.js`)
- Same sweep logic, reads from `processed_adj_cash/`
- Output: `best_combos_cash.json`

### Long-Side Systems (main dashboard)
- `backtest_low_entry.js` — System 1 (Low Entry Long): entry at confLow, SL below confLow, BE ratchet at confHigh.
- `backtest_long_refined.js` — System 2 (Breakout Long): entry above confHigh, SL at confLow, ratchets at 1R/2R/3R.
- `backtest_combined.js` — Both long systems in one tabbed HTML. Auto-selects top 15 by Calmar r2 (≥5 trades).
  - System 1 top 15: MFSL, TATACONSUM, ULTRACEMCO, ASIANPAINT, FEDERALBNK, SUNPHARMA, GRASIM, HCLTECH, INDUSINDBK, TITAN, INDHOTEL, EICHERMOT, HINDALCO, TCS, MARUTI
  - System 2 top 15: BRITANNIA, BAJAJFINSV, LT, TRENT, POONAWALLA, MARUTI, LTTS, EICHERMOT, APOLLOHOSP, INDHOTEL, ICICIBANK, M&M, SJVN, AXISBANK, SHRIRAMFIN
- `backtest_sweep_devdep.js` — Sweeps Dev% ∈ {3,4,5,7,10} × Depth ∈ {5,10,15}. Finding: EV stable (~1.0R for 2R exit, ~1.64R for 5R) across all ZigZag params — edge comes from confluence quality, not ZigZag sensitivity.

### Short-Side Systems (`backtest_short_all.js`)
Runs all 4 short setups in one script → `backtest_short_all.html` (tabbed, with Compare tab).
Signal for all: Gann Confluence date (cfCount ≥ 2, signal type ignored).
Common ratchet (inverted for short): LOW ≤ ep−1R → BE; LOW ≤ ep−2R → lock 1.5R; LOW ≤ ep−3R → lock 2R (r3).
SL trigger: candle HIGH ≥ currentSL.

| Setup | Entry | SL | Risk | EV r2 | Calmar |
|-------|-------|----|------|-------|--------|
| **A — Rejection** | Next-day candle HIGH ≥ confHigh AND CLOSE < confHigh | Rejection candle HIGH | high − close | −0.57R | −1.0 |
| **B — Breakdown** | Next-day first CLOSE < confLow | confHigh | confHigh − ep | −0.33R | −0.95 |
| **C — Trend+Breakdown** | Same as B, only when last ZigZag H < previous H (Lower High = downtrend) | confHigh | confHigh − ep | −0.30R | −0.90 |
| **D — Fade High** ✓ | Next-day first CLOSE > confHigh (fade the breakout above resistance) | Entry candle HIGH | high − close | **+0.98R** | **299** |

**Key finding:** Only Setup D has positive edge. A/B/C all negative — Gann confluence zones act as support, not resistance, so shorting into/below them fails. Fading false breakouts ABOVE confHigh (Setup D) works because the wick high provides a tight SL with high R/R.

Setup D Top 15 (Calmar r2, ≥5 trades): HINDUNILVR, ASIANPAINT, AXISBANK, APOLLOHOSP, SBIN, MARUTI, FEDERALBNK, EICHERMOT, M&M, TITAN, LT, INFY, HCLTECH, NTPC, TRENT

### Backtest Common Parameters
- ZigZag: Dev 4%, Depth 10 (adjusted daily prices)
- Portfolio: ₹10L initial capital, ₹16K fixed risk/trade, max 5 concurrent positions, FIFO flush
- Analysis years: 2020–2026. Live trades (refDate ≥ today) excluded from stats.
- Top 15 selection: sort by Calmar r2 descending, filter ≥5 closed trades, take top 15.
- rMult for shorts: (ep − exitPrice) / risk  (positive when price falls)
- Intraday data: `processed_intraday/${sym}_60min.csv`, column-index parsing (c[1]=date, c[2]=time, c[3-6]=OHLC)

### Trade Example (verified)
JSWSTEEL 2022-05-04 confluence (HL, count=2): confLow=708.05, confHigh=736.
Setup B: SHORT entered 2022-05-05 14:15 at 707.4 (SL=736, risk=28.6).
BE ratchet May-09, 1.5R lock May-10, 2R lock May-12. r1=+1R, r2=+1.5R, r3=+2R.

## Deferred
- Dynamic Cycle tab — explicitly deferred, will be worked on later.
- BANKNIFTY_F, FINNIFTY instruments — skipped for now.

## GitHub
Repository: https://github.com/rajat07august/GANN-Natural-Cycle.git
Branch: master
Excluded from repo: Gann/1–5 (raw Excel, 500MB+), Gann/6/1 (source Excel), Gann/6/confluence.html (superseded)
Backtest outputs (*.html, *.csv) excluded via .gitignore — only JS source files committed.
