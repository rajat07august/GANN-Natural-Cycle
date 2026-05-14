# Gann Cycle Dashboard — Project Notes

## Working Directory
`j:\GANN Claude\`

## Source Files (do not modify)
- `Gann/6/1/Natural Cycle.xlsx` — 48 sheets. NIFTY_F (1995–2025), BANKNIFTY_F (2005–2023), FINNIFTY (2012–2023), TCS, ~20 other stocks.
- `Gann/6/1/Dynamic Cycle_.xlsm` — 74 sheets. HOLIDAYS sheet, 70+ NSE instrument sheets, RESULT sheet (6112 rows).
- `Dataset/NIFTY50_all.csv` — OHLC for NIFTY50 stocks, 2007–2021. Used as source 1 for historical data.

## OHLC Data Sources
- **Source 1:** `Dataset/NIFTY50_all.csv` (2007–2021, NIFTY50 stocks + old NSE names)
- **Source 2:** `j:/Swing Trading/Swing Trading/processed/SYMBOL.csv` (2020–2026, 2646 stocks, updated daily via bhavcopy)
- Merged in `build_trial.js` → `mergeRows(sym)` deduplicates by date, sorts chronologically
- Historical NSE name mapping: HINDLEVER→HINDUNILVR, BHARTI→BHARTIARTL, INFOSYSTCH→INFY, JSWSTL→JSWSTEEL, HINDALC0→HINDALCO, TISCO→TATASTEEL, TELCO→TATAMOTORS, UTIBANK→AXISBANK, KOTAKMAH→KOTAKBANK, HEROHONDA→HEROMOTOCO, BAJAUTOFIN→BAJFINANCE

## Output Files
- `Gann/6/trial_natural_cycle.html` — **Main dashboard (8.5 MB).** Two-tab layout. Rebuilt by `node build_trial.js`.
- `Gann/reports/` — 49 individual ZigZag candlestick chart HTMLs + index.html. Rebuilt by `node build_chart.js`.
- `Gann/6/Gann_Cycle_Dashboard.html` — First-gen dashboard (legacy, not actively maintained).

## Build Scripts
- `build_trial.js` — Builds `trial_natural_cycle.html`. Loads OHLC for all 75 instruments, embeds data, generates two-tab HTML.
- `build_chart.js` — Builds per-stock ZigZag chart HTMLs into `Gann/reports/`.
- `update_data.js` — Daily bhavcopy updater. Downloads from NSE API, appends to processed CSVs, rebuilds HTMLs. Run: `node update_data.js`. Tracks 75 symbols (50 NIFTY50 + 25 midcap).
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

**Tab 2 — Confluence Calendar:**
- Month + Year dropdowns, ZigZag params, stats bar
- Filter by min stocks per date (Any / ≥2 / ≥3 / ≥4)
- View toggle: By Date (date cards with stock chips) / By Stock (table)
- "Midcap / Smallcap Stocks" checkbox (header) — toggles inclusion of 25 midcap stocks in both tabs

**Chart Modal:**
- Opens via 📈 button in NC tab controls (current instrument) or 📈 icon on CF stock chips
- Shows ZigZag swing line (amber) with H/L price markers
- Controls: Dev%, Depth, range buttons (1Y / 3Y / 5Y / All)
- Pivot strip at bottom (recent pivots, reverse chronological)
- Close: ✕ button, Escape key, or click backdrop

## Instruments
**NIFTY50 (51 with index):** NIFTY (index, uses NIFTY_F), + all 50 current NIFTY50 constituents
- Data coverage: most from 2000, newer additions from 2020 (ADANIENT, APOLLOHOSP, HDFCLIFE, TRENT, TATACONSUM)
- SHRIRAMFIN from 2022, ZOMATO from 2021

**Midcap/Smallcap FNO (25 stocks):** ADANIPOWER, POONAWALLA, SUZLON, FEDERALBNK, PERSISTENT, COFORGE, CANBK, SAIL, NMDC, RVNL, IRFC, MCX, NATIONALUM, INDHOTEL, LTTS, MFSL, HUDCO, SRF, POLYCAB, NHPC, SJVN, GMRINFRA, CONCOR, COCHINSHIP, MAZDOCK
- Data coverage: Jan 2020 → May 2026 (6 years). Only 3–6 of 11 Gann lookback years will have pivots.
- GMRINFRA stale until next bhavcopy update.
- NOTE: POONAWALLAFIN = NSE ticker POONAWALLA

## Known Bugs Fixed
- Confluence tab "By Date" view was blank — `dev` and `dep` not passed to `cfRenderDate()`. Fixed.
- OHLC_DATA keys with special chars (M&M, BAJAJ-AUTO) must be quoted: `'${sym}':` not `${sym}:`.
- Confluence grouping: group by day-only, not day+type (H and L on same date = one signal).

## Deferred
- Dynamic Cycle tab — explicitly deferred, will be worked on later.
- BANKNIFTY_F, FINNIFTY instruments — skipped for now.
- Additional instruments beyond current 75 — user will guide later.

## GitHub
Repository: https://github.com/rajat07august/GANN-Natural-Cycle.git
Branch: master
Excluded from repo: Gann/1–5 (raw Excel, 500MB+), Gann/6/1 (source Excel), Gann/6/confluence.html (superseded)
