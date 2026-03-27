# Budget Tab Spec — TLH Dashboard
**Author:** Anderson, Chief Analyst — Barnett Family Partners  
**Date:** 2026-03-26  
**For:** Dezayas (implementation)  
**Status:** Ready to build

---

## 1. Data Reality Check

### Source
Live Supabase (`monthly_periods` table). No seed data exists — all values come from uploaded income statements via `/api/periods`. The yearly API aggregates on the fly.

### Years Expected in DB
Based on the codebase logic (yearly API, historical API, COVID exclusion at 2020):
- **2021** — likely full 12 months (earliest operational year post-COVID)
- **2022** — full 12 months
- **2023** — full 12 months ✅ (key baseline year for 3-year trend)
- **2024** — full 12 months ✅
- **2025** — full 12 months (if closed) or partial (depends on uploads) ✅
- **2026** — partial, current year YTD (Jan–Feb confirmed by system logic)

> **The yearly API detects partial years automatically** (`months < 12`). Use this signal. 2025 completeness determines whether we show it as full or partial in the trend.

### Fields With Real Values (not null) — What Gets Populated From Income Statements
**Always populated:**
- `year`, `month`, `period`
- `rooms_available`, `rooms_sold`
- `occupancy_pct`, `adr`, `revpar`
- `room_revenue`, `fb_revenue`, `total_revenue`
- `rooms_expense`, `fb_expense`
- `admin_general`, `sales_marketing`, `property_ops_maintenance`, `utilities`
- `gross_operating_profit`, `gop_pct`
- `nop_hotel`, `nop_pct`
- `management_fees`, `property_taxes`, `insurance`

**Budget columns** (populated when budget data uploaded — may be sparse for older years):
- `room_revenue_budget`, `fb_revenue_budget`, `total_revenue_budget`
- `rooms_expense_budget`, `fb_expense_budget`
- `admin_general_budget`, `sales_marketing_budget`, `property_ops_maintenance_budget`, `utilities_budget`
- `gop_budget`, `gop_pct_budget`, `nop_hotel_budget`, `nop_pct_budget`
- `total_revenue_ytd_budget`, `gop_ytd_budget`, `nop_hotel_ytd_budget`

**Prior year columns** (populated from income statement PY columns):
- `total_revenue_py`, `room_revenue_py`, `fb_revenue_py`
- `gop_py`, `gop_pct_py`, `nop_hotel_py`, `nop_pct_py`

**YTD columns** (from income statement YTD section):
- `total_revenue_ytd`, `room_revenue_ytd`
- `gop_ytd`, `gop_pct_ytd`, `nop_hotel_ytd`, `nop_pct_ytd`
- `total_revenue_ytd_budget`, `gop_ytd_budget`, `nop_hotel_ytd_budget`

**Sparse/often null:**
- `other_operated_revenue`, `misc_income`, `other_operated_expense`, `it_telecom`
- `reserve_for_replacement`

---

## 2. What's Changing vs Current Budget Tab

### Current tab components (keep as-is):
1. **YTDScorecard** — 3 KPI cards (Revenue, GOP, NOP) with gauge bars
2. **MonthlyVarianceChart** — bar chart, monthly actual vs budget variance
3. **BudgetHitRate** — rolling 12-month hit rate tracker
4. **ExpenseHeatmap** — monthly expense adherence table

### New components to add (Wesley's 3 requirements):
1. **`ThreeYearTrendChart`** — revenue/expense/margin trend 2023–2025
2. **`YTDPivotTable`** — cumulative YTD view (replaces nothing in current tab; add above YTDScorecard)
3. **`MarginCompressionCallout`** — narrative card

### Layout after changes:
```
[MarginCompressionCallout]          ← new, full width, top of page
[ThreeYearTrendChart]               ← new, full width
[YTDPivotTable]                     ← new, full width
[YTDScorecard]                      ← existing (keep)
[MonthlyVarianceChart]              ← existing (keep)
[BudgetHitRate] [ExpenseHeatmap]    ← existing (keep)
```

---

## 3. Component Specs

---

### 3.1 `MarginCompressionCallout`

**Purpose:** Lead with the story. Revenue is growing, expenses are growing faster, NOP margin is compressing.

**Design:** Full-width card, dark amber/orange accent border (`border-amber-500/40`), background `bg-amber-950/20`. Three stat columns inside.

**Data source:** Annual aggregates from `/api/yearly` or computed from `monthly_periods` grouped by year.

**Metrics to display:**

| Column | Label | Formula |
|--------|-------|---------|
| Left | Revenue Growth | `(rev_2025 - rev_2023) / rev_2023 × 100` |
| Center | Expense Growth | `(totalExp_2025 - totalExp_2023) / totalExp_2023 × 100` |
| Right | Margin Δ | `nop_pct_2025 - nop_pct_2023` (percentage points) |

**Compute annual totals in component:**
```typescript
// For each year, sum monthly_periods rows:
const totalExpense = (year) => sum of:
  rooms_expense + fb_expense + admin_general + sales_marketing +
  property_ops_maintenance + utilities + management_fees +
  property_taxes + insurance

// nop_pct by year = sum(nop_hotel) / sum(total_revenue)
```

**Narrative text (static below stats):**
```
"Revenue has grown [X]% from 2023 to 2025, but total operating expenses 
have grown [Y]%. NOP margin has compressed [Z]pp — from [A]% to [B]%."
```

**Color logic:**
- Revenue growth % → `text-emerald-400`
- Expense growth % → `text-red-400`
- Margin Δ → `text-red-400` (it's negative; that's the point)

**Data gap handling:** If 2023, 2024, or 2025 have fewer than 10 months, show a `⚠ Partial year data — annualized` badge next to the year label.

---

### 3.2 `ThreeYearTrendChart`

**Purpose:** Visual 3-year trend — revenue, expense stack, NOP margin line.

**Chart type:** Recharts `ComposedChart` (bars + line)

**X-axis:** `["2023", "2024", "2025"]` — three bars

**Datasets:**

| Dataset | Type | Color | Y-axis |
|---------|------|-------|--------|
| Total Revenue | Bar | `#3b82f6` (blue) | Left (dollars) |
| Total Expense | Bar | `#f87171` (red/400) | Left (dollars) |
| NOP Margin % | Line | `#f59e0b` (amber) | Right (percent) |

**Y-axes:**
- Left: dollar format, `tickFormatter={(v) => '$' + (v/1000).toFixed(0) + 'K'}` or M if > 1M
- Right: percent format `tickFormatter={(v) => v.toFixed(1) + '%'}`, domain `[0, 'auto']`

**Bar layout:** Side-by-side (not stacked). `barCategoryGap="20%"` `barGap={4}`

**Chart height:** `h-72`

**Tooltip:** Custom — show year, revenue $, expense $, NOP margin %

**Data computation (in component):**
```typescript
const yearData = [2023, 2024, 2025].map(yr => {
  const periods = data.filter(d => d.year === yr);
  const revenue = sum(periods, 'total_revenue') / 100;  // to dollars
  const expense = sum(periods, p =>
    (p.rooms_expense ?? 0) + (p.fb_expense ?? 0) + (p.admin_general ?? 0) +
    (p.sales_marketing ?? 0) + (p.property_ops_maintenance ?? 0) +
    (p.utilities ?? 0) + (p.management_fees ?? 0) +
    (p.property_taxes ?? 0) + (p.insurance ?? 0)
  ) / 100;
  const nop = sum(periods, 'nop_hotel') / 100;
  const nopPct = revenue > 0 ? (nop / revenue) * 100 : 0;
  const months = periods.length;
  return { year: String(yr), revenue, expense, nopPct, months };
});
```

**Partial year annotation:** If `months < 12`, add asterisk to year label (`"2025*"`) and footnote below chart: `* Partial year data (N months)`

**Title:** `"3-Year Revenue & Expense Trend"` + subtitle `"NOP margin compression — revenue growing, expenses growing faster"`

---

### 3.3 `YTDPivotTable`

**Purpose:** Single cumulative YTD view through latest available month. Three columns: Actual / Budget / Prior Year (same period).

**Remove from spec:** Wesley said remove standalone Jan/Feb monthly rows. The current Budget tab doesn't have standalone monthly rows — this is a new table, not a replacement. Just build the YTD cumulative view.

**Latest month detection:**
```typescript
const ytdPeriods = data.filter(d => d.year === currentYear);
const latestMonth = ytdPeriods[ytdPeriods.length - 1]; // last by month order
const throughLabel = `Jan–${monthName(latestMonth.month)} ${currentYear}`;
```

**YTD Calculation Logic:**

Use the `_ytd` columns from the income statement when available — they're the most reliable:
```typescript
// PRIMARY: Use pre-calculated YTD from income statement (last period's _ytd field)
const ytdRevActual   = latestMonth.total_revenue_ytd;
const ytdGopActual   = latestMonth.gop_ytd;
const ytdNopActual   = latestMonth.nop_hotel_ytd;
const ytdRevBudget   = latestMonth.total_revenue_ytd_budget;
const ytdGopBudget   = latestMonth.gop_ytd_budget;
const ytdNopBudget   = latestMonth.nop_hotel_ytd_budget;

// FALLBACK: Sum monthly actuals if _ytd columns are null
const ytdRevActualCalc = ytdPeriods.reduce((s, p) => s + (p.total_revenue ?? 0), 0);
const ytdGopActualCalc = ytdPeriods.reduce((s, p) => s + (p.gross_operating_profit ?? 0), 0);
const ytdNopActualCalc = ytdPeriods.reduce((s, p) => s + (p.nop_hotel ?? 0), 0);
```

**Prior Year Same Period:**  
Use the `_py` columns from the latest month (they represent PTD, not YTD). For YTD PY, sum prior year monthly rows:
```typescript
// Get same months from prior year
const priorYearPeriods = data
  .filter(d => d.year === currentYear - 1 && d.month <= latestMonth.month);
const ytdRevPY = priorYearPeriods.reduce((s, p) => s + (p.total_revenue ?? 0), 0);
const ytdNopPY = priorYearPeriods.reduce((s, p) => s + (p.nop_hotel ?? 0), 0);
const ytdGopPY = priorYearPeriods.reduce((s, p) => s + (p.gross_operating_profit ?? 0), 0);
```

**Table structure:**

| Metric | YTD Actual | YTD Budget | vs Budget | Prior Year | vs PY |
|--------|-----------|------------|-----------|------------|-------|
| Total Revenue | $XXX,XXX | $XXX,XXX | +X.X% | $XXX,XXX | +X.X% |
| Room Revenue | $XXX,XXX | — | — | $XXX,XXX | +X.X% |
| F&B Revenue | $XXX,XXX | — | — | $XXX,XXX | +X.X% |
| Rooms Expense | $XXX,XXX | $XXX,XXX | +X.X% | — | — |
| Admin & General | $XXX,XXX | $XXX,XXX | +X.X% | — | — |
| Sales & Marketing | $XXX,XXX | $XXX,XXX | +X.X% | — | — |
| Property Ops | $XXX,XXX | $XXX,XXX | +X.X% | — | — |
| Utilities | $XXX,XXX | $XXX,XXX | +X.X% | — | — |
| **GOP** | $XXX,XXX | $XXX,XXX | +X.X% | $XXX,XXX | +X.X% |
| GOP % | XX.X% | XX.X% | +Xpp | XX.X% | +Xpp |
| **NOP** | $XXX,XXX | $XXX,XXX | +X.X% | $XXX,XXX | +X.X% |
| NOP % | XX.X% | XX.X% | +Xpp | XX.X% | +Xpp |

**Column header:** `"YTD — Jan through [Month] [Year]"`

**Color for vs-columns:**
- Revenue lines: green if actual > budget/PY, red if under
- Expense lines: green if actual < budget (under is good), red if over
- Profit lines (GOP, NOP): green if actual > budget/PY

**Show `—` when:** budget or PY data is null for that field. Don't show zeros.

**Note on expense YTD vs Budget:** Only departmental expenses have budget columns (`rooms_expense_budget`, `fb_expense_budget`, `admin_general_budget`, `sales_marketing_budget`, `property_ops_maintenance_budget`, `utilities_budget`). No YTD budget for individual expense lines — show PTD budget comparison only, or omit budget column for those rows. Keep it honest.

---

## 4. Data Gaps Dezayas Must Handle

| Gap | Impact | Handling |
|-----|--------|----------|
| Budget columns null for 2023/older years | 3-year trend won't have expense budget comparisons | Skip budget comparison for those years; only show actuals |
| `_ytd` fields null in early months | YTD pivot has no pre-calc YTD | Fall back to summing monthly actuals (fallback logic above) |
| 2025 is partial year | 3-year trend shows partial year | Show `"2025*"` with asterisk + footnote |
| Expense totals not stored as a single field | Must compute total expense on the fly | Sum the 9 expense fields; see formula in ThreeYearTrendChart spec |
| `other_operated_revenue`, `misc_income` sparse | Total revenue may look incomplete if summed manually | Always use `total_revenue` field directly, not a sum of revenue sub-lines |
| `management_fees`, `property_taxes`, `insurance` may be null in older data | Below-the-line items affect NOP | Null-coalesce to 0 in expense sum, but flag if all three are null for a period (data may be missing) |
| PY columns are period-only (not YTD) | Can't use `total_revenue_py` from latest month for YTD comparison | Sum prior-year monthly rows directly (logic above) |
| No pre-computed annual expense total | Margin compression callout needs it | Compute in component — sum 9 expense fields across all months for the year |

---

## 5. Margin Compression Callout — Exact Formula

Given Wesley's framing: **revenue growing, expenses growing faster, margins compressing.**

```typescript
// Annual aggregates (sum of monthly rows, cents → dollars)
const revByYear = {
  2023: sum2023_total_revenue / 100,
  2024: sum2024_total_revenue / 100,
  2025: sum2025_total_revenue / 100,
}

const expByYear = {
  2023: computeAnnualExpense(2023) / 100,  // see formula above
  2024: computeAnnualExpense(2024) / 100,
  2025: computeAnnualExpense(2025) / 100,
}

const nopPctByYear = {
  2023: sum2023_nop / sum2023_revenue,
  2024: sum2024_nop / sum2024_revenue,
  2025: sum2025_nop / sum2025_revenue,
}

// What to display:
const revenueGrowthPct = (revByYear[2025] - revByYear[2023]) / revByYear[2023] * 100
const expenseGrowthPct = (expByYear[2025] - expByYear[2023]) / expByYear[2023] * 100
const marginDeltaPp    = nopPctByYear[2025] * 100 - nopPctByYear[2023] * 100

// Narrative:
// "Revenue +{revenueGrowthPct.toFixed(1)}% since 2023 | 
//  Expenses +{expenseGrowthPct.toFixed(1)}% | 
//  NOP margin: {nopPct2023.toFixed(1)}% → {nopPct2025.toFixed(1)}% ({marginDeltaPp > 0 ? '+' : ''}{marginDeltaPp.toFixed(1)}pp)"
```

**If 2025 is partial:** Annualize before computing growth. Annualized = (YTD / months) × 12. Add `*` marker.

---

## 6. API Strategy

**Don't add new API routes** unless necessary. Use the existing `useMonthlyData()` hook which returns all `monthly_periods` rows. Compute aggregations client-side in each component.

Exception: If performance is an issue with large datasets, extract year-level aggregation into a utility function `aggregateByYear(data: MonthlyPeriod[]): YearSummary[]` shared across components.

---

## 7. Implementation Order for Dezayas

1. **`aggregateByYear()` utility** — write once, use in all three new components
2. **`MarginCompressionCallout`** — builds from aggregate, sets narrative frame
3. **`ThreeYearTrendChart`** — visual layer on top of same aggregates
4. **`YTDPivotTable`** — most complex; handle null-coalescing carefully
5. **Wire into page layout** — insert above existing components

---

*Anderson out. Numbers don't lie — the compression story is real. Build it so Wesley can see it clearly.*
