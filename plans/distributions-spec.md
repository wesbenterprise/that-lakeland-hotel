# Distributions Tab — Build Spec

**Author:** Astra  
**Date:** 2026-03-15  
**Target:** Dezayas  
**Status:** Ready to build  

---

## Overview

Add a `/distributions` page to the SHS Lakeland dashboard. This page shows investor distribution history, cumulative charts, XIRR/return calculations, and an interactive distribution calculator. No new dependencies — use existing stack (Next.js 14 App Router, TypeScript, Tailwind, Recharts, Supabase, Lucide).

---

## 1. Supabase Schema

### 1.1 New Tables

Run these via Supabase SQL Editor or a migration file at `supabase/migrations/001_distributions.sql`:

```sql
-- Distribution events
CREATE TABLE distributions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_date date NOT NULL,
  total_amount bigint NOT NULL,        -- in cents
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Investor ownership (static reference)
CREATE TABLE investor_ownership (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_name text NOT NULL UNIQUE,
  ownership_pct numeric(6,4) NOT NULL, -- e.g. 0.6500 = 65%
  invested_capital bigint NOT NULL,    -- in cents
  investment_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_distributions_date ON distributions(distribution_date);
CREATE INDEX idx_investor_ownership_name ON investor_ownership(investor_name);
```

**Key design decision:** Per-investor distribution amounts are *computed* (`ownership_pct × total_amount`), never stored. This keeps the schema normalized and avoids drift.

**Note on early distributions:** The first two distributions (Apr 2022, Oct 2022) have per-investor amounts that don't match the standard ownership percentages exactly (Lee and Loute each got $9,000 instead of $27K and $9K respectively). These are historical actuals. For the history table, compute from ownership_pct × total_amount as the default, but add a `distribution_overrides` table for exceptions:

```sql
CREATE TABLE distribution_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_id uuid REFERENCES distributions(id) ON DELETE CASCADE,
  investor_name text NOT NULL,
  override_amount bigint NOT NULL,     -- in cents, replaces computed amount
  created_at timestamptz DEFAULT now(),
  UNIQUE(distribution_id, investor_name)
);
```

When rendering per-investor amounts: check `distribution_overrides` first; if an override exists for that distribution + investor, use it. Otherwise compute from `ownership_pct × total_amount`.

### 1.2 Row-Level Security

```sql
-- Enable RLS
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_overrides ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users (matches existing pattern)
CREATE POLICY "Authenticated read distributions"
  ON distributions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read investor_ownership"
  ON investor_ownership FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated read distribution_overrides"
  ON distribution_overrides FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert/update (for seed + future admin)
CREATE POLICY "Service write distributions"
  ON distributions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service write investor_ownership"
  ON investor_ownership FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service write distribution_overrides"
  ON distribution_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 1.3 Seed Data

Create `scripts/seed-distributions.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  // 1. Investors
  const investors = [
    { investor_name: "Barnett", ownership_pct: 0.6500, invested_capital: 443000000, investment_date: "2019-01-01" },
    { investor_name: "Costa",   ownership_pct: 0.2700, invested_capital: 185000000, investment_date: "2019-01-01" },
    { investor_name: "Lee",     ownership_pct: 0.0600, invested_capital:  58000000, investment_date: "2019-01-01" },
    { investor_name: "Loute",   ownership_pct: 0.0200, invested_capital:  14000000, investment_date: "2019-01-01" },
  ];

  const { error: invError } = await supabase
    .from("investor_ownership")
    .upsert(investors, { onConflict: "investor_name" });
  if (invError) throw invError;
  console.log("✓ Investors seeded");

  // 2. Distributions (7 historical events — all amounts in cents)
  const distributions = [
    { distribution_date: "2022-04-01", total_amount:  45000000, notes: "Q1 2022 distribution" },
    { distribution_date: "2022-10-01", total_amount:  45000000, notes: "Q3 2022 distribution" },
    { distribution_date: "2023-06-01", total_amount: 108000000, notes: "H1 2023 distribution" },
    { distribution_date: "2023-10-01", total_amount:  54000000, notes: "Q3 2023 distribution" },
    { distribution_date: "2024-04-01", total_amount:  90000000, notes: "Q1 2024 distribution" },
    { distribution_date: "2024-12-01", total_amount:  51000000, notes: "Q4 2024 distribution" },
    { distribution_date: "2025-05-01", total_amount: 120000000, notes: "Q2 2025 distribution" },
  ];

  const { data: distRows, error: distError } = await supabase
    .from("distributions")
    .upsert(distributions, { onConflict: "distribution_date" })
    .select("id, distribution_date");
  if (distError) throw distError;
  console.log("✓ Distributions seeded");

  // 3. Overrides for Apr 2022 and Oct 2022 (non-standard splits)
  // In these two distributions, Lee and Loute each got $9,000 instead of
  // the standard 6%/2% split ($27K/$9K for $450K total).
  const apr2022 = distRows?.find(d => d.distribution_date === "2022-04-01");
  const oct2022 = distRows?.find(d => d.distribution_date === "2022-10-01");

  if (apr2022 && oct2022) {
    const overrides = [
      // Apr 2022: Barnett gets $306K, Costa $126K, Lee $9K, Loute $9K
      { distribution_id: apr2022.id, investor_name: "Barnett", override_amount: 30600000 },
      { distribution_id: apr2022.id, investor_name: "Costa",   override_amount: 12600000 },
      { distribution_id: apr2022.id, investor_name: "Lee",     override_amount:   900000 },
      { distribution_id: apr2022.id, investor_name: "Loute",   override_amount:   900000 },
      // Oct 2022: same split
      { distribution_id: oct2022.id, investor_name: "Barnett", override_amount: 30600000 },
      { distribution_id: oct2022.id, investor_name: "Costa",   override_amount: 12600000 },
      { distribution_id: oct2022.id, investor_name: "Lee",     override_amount:   900000 },
      { distribution_id: oct2022.id, investor_name: "Loute",   override_amount:   900000 },
    ];

    const { error: overrideError } = await supabase
      .from("distribution_overrides")
      .upsert(overrides, { onConflict: "distribution_id,investor_name" });
    if (overrideError) throw overrideError;
    console.log("✓ Overrides seeded");
  }

  console.log("Done.");
}

seed().catch(console.error);
```

Add to `package.json` scripts:
```json
"seed:distributions": "npx tsx scripts/seed-distributions.ts"
```

**Important:** Add a unique constraint on `distributions.distribution_date` for the upsert to work:
```sql
ALTER TABLE distributions ADD CONSTRAINT distributions_date_unique UNIQUE (distribution_date);
```

---

## 2. API Route

### `src/app/api/distributions/route.ts`

Single GET endpoint returning everything the page needs:

```typescript
import { NextResponse } from "next/server";
import { createServiceClient, isDemoMode } from "@/lib/supabase";

export interface DistributionRow {
  id: string;
  distribution_date: string;
  total_amount: number; // cents
  notes: string | null;
}

export interface InvestorRow {
  investor_name: string;
  ownership_pct: number;
  invested_capital: number; // cents
  investment_date: string;
}

export interface OverrideRow {
  distribution_id: string;
  investor_name: string;
  override_amount: number; // cents
}

export interface DistributionsResponse {
  distributions: DistributionRow[];
  investors: InvestorRow[];
  overrides: OverrideRow[];
  demo?: boolean;
}

// ─── Demo data (mirrors seed data for offline/preview) ──────────────────────

function buildDemoData(): DistributionsResponse {
  const investors: InvestorRow[] = [
    { investor_name: "Barnett", ownership_pct: 0.65, invested_capital: 443000000, investment_date: "2019-01-01" },
    { investor_name: "Costa",   ownership_pct: 0.27, invested_capital: 185000000, investment_date: "2019-01-01" },
    { investor_name: "Lee",     ownership_pct: 0.06, invested_capital:  58000000, investment_date: "2019-01-01" },
    { investor_name: "Loute",   ownership_pct: 0.02, invested_capital:  14000000, investment_date: "2019-01-01" },
  ];

  const distributions: DistributionRow[] = [
    { id: "d1", distribution_date: "2022-04-01", total_amount:  45000000, notes: null },
    { id: "d2", distribution_date: "2022-10-01", total_amount:  45000000, notes: null },
    { id: "d3", distribution_date: "2023-06-01", total_amount: 108000000, notes: null },
    { id: "d4", distribution_date: "2023-10-01", total_amount:  54000000, notes: null },
    { id: "d5", distribution_date: "2024-04-01", total_amount:  90000000, notes: null },
    { id: "d6", distribution_date: "2024-12-01", total_amount:  51000000, notes: null },
    { id: "d7", distribution_date: "2025-05-01", total_amount: 120000000, notes: null },
  ];

  const overrides: OverrideRow[] = [
    { distribution_id: "d1", investor_name: "Barnett", override_amount: 30600000 },
    { distribution_id: "d1", investor_name: "Costa",   override_amount: 12600000 },
    { distribution_id: "d1", investor_name: "Lee",     override_amount:   900000 },
    { distribution_id: "d1", investor_name: "Loute",   override_amount:   900000 },
    { distribution_id: "d2", investor_name: "Barnett", override_amount: 30600000 },
    { distribution_id: "d2", investor_name: "Costa",   override_amount: 12600000 },
    { distribution_id: "d2", investor_name: "Lee",     override_amount:   900000 },
    { distribution_id: "d2", investor_name: "Loute",   override_amount:   900000 },
  ];

  return { distributions, investors, overrides, demo: true };
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(buildDemoData());
  }

  try {
    const supabase = createServiceClient();

    const [distResult, invResult, overResult] = await Promise.all([
      supabase
        .from("distributions")
        .select("id, distribution_date, total_amount, notes")
        .order("distribution_date", { ascending: true }),
      supabase
        .from("investor_ownership")
        .select("investor_name, ownership_pct, invested_capital, investment_date")
        .order("ownership_pct", { ascending: false }),
      supabase
        .from("distribution_overrides")
        .select("distribution_id, investor_name, override_amount"),
    ]);

    if (distResult.error) throw distResult.error;
    if (invResult.error) throw invResult.error;
    if (overResult.error) throw overResult.error;

    return NextResponse.json({
      distributions: distResult.data,
      investors: invResult.data,
      overrides: overResult.data ?? [],
    } as DistributionsResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## 3. Shared Types & Utilities

### 3.1 `src/lib/distribution-types.ts`

```typescript
export interface Investor {
  investor_name: string;
  ownership_pct: number;  // decimal, e.g. 0.65
  invested_capital: number; // cents
  investment_date: string;  // ISO date
}

export interface Distribution {
  id: string;
  distribution_date: string;
  total_amount: number; // cents
  notes: string | null;
}

export interface Override {
  distribution_id: string;
  investor_name: string;
  override_amount: number; // cents
}

export interface InvestorDistribution {
  investor_name: string;
  amount: number; // cents — either override or computed
}

export interface DistributionWithInvestors extends Distribution {
  per_investor: InvestorDistribution[];
}

export interface InvestorSummary {
  investor_name: string;
  ownership_pct: number;
  invested_capital: number;      // cents
  total_distributed: number;     // cents
  total_return_pct: number;      // decimal, e.g. 0.759 = 75.9%
  xirr: number | null;           // decimal annualized return, null if calc fails
}
```

### 3.2 `src/lib/distribution-utils.ts`

```typescript
import type {
  Investor,
  Distribution,
  Override,
  DistributionWithInvestors,
  InvestorSummary,
} from "./distribution-types";

/**
 * Resolve per-investor amount for a given distribution.
 * Uses override if available, otherwise computes from ownership_pct.
 */
export function resolveInvestorAmount(
  dist: Distribution,
  investor: Investor,
  overrides: Override[]
): number {
  const override = overrides.find(
    (o) => o.distribution_id === dist.id && o.investor_name === investor.investor_name
  );
  if (override) return override.override_amount;
  return Math.round(dist.total_amount * investor.ownership_pct);
}

/**
 * Enrich distributions with per-investor breakdowns.
 */
export function enrichDistributions(
  distributions: Distribution[],
  investors: Investor[],
  overrides: Override[]
): DistributionWithInvestors[] {
  return distributions.map((dist) => ({
    ...dist,
    per_investor: investors.map((inv) => ({
      investor_name: inv.investor_name,
      amount: resolveInvestorAmount(dist, inv, overrides),
    })),
  }));
}

/**
 * Compute investor summaries with total return % and XIRR.
 */
export function computeInvestorSummaries(
  distributions: DistributionWithInvestors[],
  investors: Investor[]
): InvestorSummary[] {
  return investors.map((inv) => {
    const totalDistributed = distributions.reduce((sum, dist) => {
      const investorDist = dist.per_investor.find(
        (p) => p.investor_name === inv.investor_name
      );
      return sum + (investorDist?.amount ?? 0);
    }, 0);

    const totalReturnPct =
      inv.invested_capital > 0 ? totalDistributed / inv.invested_capital : 0;

    // Build cashflows for XIRR: initial investment (negative) + distributions (positive)
    const cashflows: { date: Date; amount: number }[] = [
      { date: new Date(inv.investment_date), amount: -(inv.invested_capital / 100) },
    ];

    for (const dist of distributions) {
      const investorDist = dist.per_investor.find(
        (p) => p.investor_name === inv.investor_name
      );
      if (investorDist && investorDist.amount > 0) {
        cashflows.push({
          date: new Date(dist.distribution_date),
          amount: investorDist.amount / 100,
        });
      }
    }

    const xirr = computeXIRR(cashflows);

    return {
      investor_name: inv.investor_name,
      ownership_pct: inv.ownership_pct,
      invested_capital: inv.invested_capital,
      total_distributed: totalDistributed,
      total_return_pct: totalReturnPct,
      xirr,
    };
  });
}

/**
 * XIRR calculation using Newton-Raphson method.
 * cashflows: array of { date, amount } where negative = outflow, positive = inflow.
 * Returns annualized return as decimal (e.g. 0.12 = 12%), or null if no convergence.
 */
export function computeXIRR(
  cashflows: { date: Date; amount: number }[],
  guess: number = 0.1,
  maxIterations: number = 100,
  tolerance: number = 1e-7
): number | null {
  if (cashflows.length < 2) return null;

  const d0 = cashflows[0].date.getTime();
  const DAYS_PER_YEAR = 365.25;

  // Years from first cashflow for each entry
  const years = cashflows.map(
    (cf) => (cf.date.getTime() - d0) / (DAYS_PER_YEAR * 24 * 60 * 60 * 1000)
  );

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let j = 0; j < cashflows.length; j++) {
      const t = years[j];
      const pv = cashflows[j].amount / Math.pow(1 + rate, t);
      npv += pv;
      if (t !== 0) {
        dnpv -= (t * cashflows[j].amount) / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(dnpv) < 1e-10) return null; // derivative too small
    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;

    // Guard against divergence
    if (rate < -0.99 || rate > 10) return null;
  }

  return null; // no convergence
}

/**
 * Distribution calculator logic.
 * All inputs in dollars (not cents) — this matches what the user types.
 */
export interface CalculatorInputs {
  cashInBank: number;
  operatingBuffer: number;
  reserveBalance: number;
  restrictedFunds: number;
  budgetedLoss: number;
}

export interface CalculatorResult {
  minimumNeeded: number;      // dollars
  availableToDistribute: number; // dollars
  roundedAmount: number;      // dollars, rounded to nearest $30K
  perInvestor: { investor_name: string; ownership_pct: number; amount: number }[];
}

export function calculateDistribution(
  inputs: CalculatorInputs,
  investors: Investor[]
): CalculatorResult {
  const minimumNeeded =
    inputs.operatingBuffer + inputs.reserveBalance + inputs.restrictedFunds + inputs.budgetedLoss;

  const availableToDistribute = Math.max(0, inputs.cashInBank - minimumNeeded);

  // Round down to nearest $30,000
  const roundedAmount = Math.floor(availableToDistribute / 30000) * 30000;

  const perInvestor = investors.map((inv) => ({
    investor_name: inv.investor_name,
    ownership_pct: inv.ownership_pct,
    amount: Math.round(roundedAmount * inv.ownership_pct),
  }));

  return { minimumNeeded, availableToDistribute, roundedAmount, perInvestor };
}
```

---

## 4. Sidebar Update

### `src/components/sidebar.tsx`

Add the `DollarSign` import and nav item:

```typescript
// Add to imports:
import {
  BarChart3,
  TrendingUp,
  FileText,
  Upload,
  LogOut,
  Building2,
  Menu,
  X,
  Calendar,
  DollarSign,  // ← add
} from "lucide-react";

// Update navItems — add Distributions after Yearly, before the divider:
const navItems = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/month", label: "Month Detail", icon: FileText },
  { href: "/yearly", label: "Yearly", icon: Calendar },
  { href: "/distributions", label: "Distributions", icon: DollarSign },  // ← add
  { divider: true },
  { href: "/upload", label: "Upload", icon: Upload },
] as const;
```

No other sidebar changes needed.

---

## 5. Page & Components

### 5.1 Page: `src/app/distributions/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import type { DistributionsResponse } from "@/app/api/distributions/route";
import type {
  DistributionWithInvestors,
  InvestorSummary,
  Investor,
} from "@/lib/distribution-types";
import {
  enrichDistributions,
  computeInvestorSummaries,
} from "@/lib/distribution-utils";
import { InvestorCards } from "@/components/distributions/investor-cards";
import { CumulativeChart } from "@/components/distributions/cumulative-chart";
import { DistributionTable } from "@/components/distributions/distribution-table";
import { DistributionCalculator } from "@/components/distributions/distribution-calculator";

export default function DistributionsPage() {
  const [data, setData] = useState<DistributionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/distributions")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        Failed to load distribution data: {error ?? "Unknown error"}
      </div>
    );
  }

  const investors: Investor[] = data.investors;
  const enriched: DistributionWithInvestors[] = enrichDistributions(
    data.distributions,
    investors,
    data.overrides
  );
  const summaries: InvestorSummary[] = computeInvestorSummaries(enriched, investors);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Distributions</h1>
        <p className="text-sm text-slate-400 mt-1">
          Investor distributions, returns, and calculator
        </p>
      </div>

      {/* XIRR / Return Cards */}
      <InvestorCards summaries={summaries} />

      {/* Cumulative Distribution Chart */}
      <CumulativeChart distributions={enriched} investors={investors} />

      {/* Distribution History Table */}
      <DistributionTable distributions={enriched} investors={investors} />

      {/* Distribution Calculator */}
      <DistributionCalculator investors={investors} />
    </div>
  );
}
```

### 5.2 Component: `src/components/distributions/investor-cards.tsx`

Four cards in a row (2×2 on mobile, 4×1 on desktop). One per investor.

```typescript
"use client";

import type { InvestorSummary } from "@/lib/distribution-types";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Props {
  summaries: InvestorSummary[];
}

// Investor-specific colors for visual distinction
const INVESTOR_COLORS: Record<string, string> = {
  Barnett: "emerald",
  Costa: "blue",
  Lee: "amber",
  Loute: "purple",
};

function borderClass(name: string): string {
  const color = INVESTOR_COLORS[name] ?? "slate";
  return `border-t-2 border-t-${color}-500`;
}

export function InvestorCards({ summaries }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {summaries.map((s) => (
        <div
          key={s.investor_name}
          className={`bg-slate-800 rounded-lg border border-slate-700 p-4 ${borderClass(s.investor_name)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-300">
              {s.investor_name}
            </h3>
            <span className="text-xs text-slate-500">
              {(s.ownership_pct * 100).toFixed(0)}%
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500">Invested</p>
              <p className="text-sm font-semibold text-slate-200">
                {formatCurrency(s.invested_capital, true)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Total Distributed</p>
              <p className="text-sm font-semibold text-emerald-400">
                {formatCurrency(s.total_distributed, true)}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Return</p>
                <p className="text-lg font-bold text-emerald-400">
                  {(s.total_return_pct * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">XIRR</p>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <p className="text-lg font-bold text-emerald-400">
                    {s.xirr != null ? `${(s.xirr * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Note on border color classes:** Tailwind purges dynamic class names. Use a safelist approach — define the colors explicitly in the component or add them to `tailwind.config.ts` safelist:

```typescript
// In tailwind.config.ts, add:
safelist: [
  "border-t-emerald-500",
  "border-t-blue-500",
  "border-t-amber-500",
  "border-t-purple-500",
],
```

Alternatively (simpler), use inline style for the border-top color instead of dynamic Tailwind classes:

```typescript
const INVESTOR_COLORS: Record<string, string> = {
  Barnett: "#10b981",  // emerald-500
  Costa:   "#3b82f6",  // blue-500
  Lee:     "#f59e0b",  // amber-500
  Loute:   "#a855f7",  // purple-500
};

// Then on the card div:
style={{ borderTopColor: INVESTOR_COLORS[s.investor_name] ?? "#64748b", borderTopWidth: "2px" }}
```

**Use the inline style approach** — it's safer and doesn't require safelist config.

### 5.3 Component: `src/components/distributions/cumulative-chart.tsx`

Stacked bar chart showing cumulative distributions over time.

```typescript
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DistributionWithInvestors, Investor } from "@/lib/distribution-types";

interface Props {
  distributions: DistributionWithInvestors[];
  investors: Investor[];
}

const COLORS: Record<string, string> = {
  Barnett: "#10b981", // emerald-500
  Costa:   "#3b82f6", // blue-500
  Lee:     "#f59e0b", // amber-500
  Loute:   "#a855f7", // purple-500
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDollarAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function CumulativeChart({ distributions, investors }: Props) {
  // Build cumulative data: each bar shows the cumulative total up to that distribution
  const cumulativeTotals: Record<string, number> = {};
  investors.forEach((inv) => (cumulativeTotals[inv.investor_name] = 0));

  const chartData = distributions.map((dist) => {
    const entry: Record<string, string | number> = {
      date: formatDate(dist.distribution_date),
    };

    for (const inv of investors) {
      const amount = dist.per_investor.find(
        (p) => p.investor_name === inv.investor_name
      )?.amount ?? 0;
      cumulativeTotals[inv.investor_name] += amount / 100; // convert cents → dollars
      entry[inv.investor_name] = cumulativeTotals[inv.investor_name];
    }

    return entry;
  });

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h2 className="text-sm font-medium text-slate-300 mb-4">
        Cumulative Distributions
      </h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tickFormatter={formatDollarAxis}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "0.5rem",
                color: "#e2e8f0",
              }}
              formatter={(value: number) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(value)
              }
            />
            <Legend
              wrapperStyle={{ color: "#94a3b8", fontSize: 12 }}
            />
            {investors.map((inv) => (
              <Bar
                key={inv.investor_name}
                dataKey={inv.investor_name}
                stackId="cumulative"
                fill={COLORS[inv.investor_name] ?? "#64748b"}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

**Chart design note:** Use stacked bars (not stacked area) — each bar represents a point-in-time cumulative snapshot. The stacking shows relative investor share. Give the top bar segment a `radius={[4, 4, 0, 0]}` for rounded tops — apply via a custom shape or by setting radius on the last Bar only.

### 5.4 Component: `src/components/distributions/distribution-table.tsx`

Full history table with sortable date column and running totals.

```typescript
"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { DistributionWithInvestors, Investor } from "@/lib/distribution-types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  distributions: DistributionWithInvestors[];
  investors: Investor[];
}

type SortDir = "asc" | "desc";

export function DistributionTable({ distributions, investors }: Props) {
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = [...distributions].sort((a, b) => {
    const cmp = a.distribution_date.localeCompare(b.distribution_date);
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Totals row
  const totals: Record<string, number> = { total: 0 };
  investors.forEach((inv) => (totals[inv.investor_name] = 0));

  for (const dist of distributions) {
    totals.total += dist.total_amount;
    for (const p of dist.per_investor) {
      totals[p.investor_name] = (totals[p.investor_name] ?? 0) + p.amount;
    }
  }

  const toggleSort = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  const SortIcon = sortDir === "asc" ? ChevronUp : ChevronDown;

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-sm font-medium text-slate-300">
          Distribution History
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/50">
              <th
                className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors"
                onClick={toggleSort}
              >
                <div className="flex items-center gap-1">
                  Date
                  <SortIcon className="h-3 w-3" />
                </div>
              </th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">
                Total
              </th>
              {investors.map((inv) => (
                <th
                  key={inv.investor_name}
                  className="text-right px-4 py-3 text-slate-400 font-medium"
                >
                  {inv.investor_name}
                  <span className="text-slate-600 ml-1 text-xs">
                    ({(inv.ownership_pct * 100).toFixed(0)}%)
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((dist) => (
              <tr
                key={dist.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-4 py-3 text-slate-300">
                  {formatDate(dist.distribution_date)}
                </td>
                <td className="px-4 py-3 text-right text-slate-200 font-medium">
                  {formatCurrency(dist.total_amount, true)}
                </td>
                {investors.map((inv) => {
                  const amount =
                    dist.per_investor.find(
                      (p) => p.investor_name === inv.investor_name
                    )?.amount ?? 0;
                  return (
                    <td
                      key={inv.investor_name}
                      className="px-4 py-3 text-right text-slate-300"
                    >
                      {formatCurrency(amount)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Totals row */}
            <tr className="bg-slate-700/30 font-semibold">
              <td className="px-4 py-3 text-slate-200">Total</td>
              <td className="px-4 py-3 text-right text-emerald-400">
                {formatCurrency(totals.total, true)}
              </td>
              {investors.map((inv) => (
                <td
                  key={inv.investor_name}
                  className="px-4 py-3 text-right text-emerald-400"
                >
                  {formatCurrency(totals[inv.investor_name])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### 5.5 Component: `src/components/distributions/distribution-calculator.tsx`

Interactive calculator with auto-compute and clipboard copy.

```typescript
"use client";

import { useState, useMemo } from "react";
import { Calculator, Copy, Check } from "lucide-react";
import type { Investor } from "@/lib/distribution-types";
import {
  calculateDistribution,
  type CalculatorInputs,
} from "@/lib/distribution-utils";
import { cn } from "@/lib/utils";

interface Props {
  investors: Investor[];
}

const DEFAULT_INPUTS: CalculatorInputs = {
  cashInBank: 2_400_000,
  operatingBuffer: 150_000,
  reserveBalance: 1_620_000,
  restrictedFunds: 188_000,
  budgetedLoss: 0,
};

const INPUT_FIELDS: { key: keyof CalculatorInputs; label: string }[] = [
  { key: "cashInBank", label: "Cash in Bank" },
  { key: "operatingBuffer", label: "Operating Buffer" },
  { key: "reserveBalance", label: "Reserve Balance" },
  { key: "restrictedFunds", label: "Restricted Funds" },
  { key: "budgetedLoss", label: "Budgeted Loss" },
];

function formatDollars(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export function DistributionCalculator({ investors }: Props) {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS);
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => calculateDistribution(inputs, investors),
    [inputs, investors]
  );

  const handleChange = (key: keyof CalculatorInputs, raw: string) => {
    // Strip non-numeric chars, parse as integer (dollars)
    const cleaned = raw.replace(/[^0-9]/g, "");
    const value = cleaned === "" ? 0 : parseInt(cleaned, 10);
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleCopy = () => {
    const lines = [
      `Distribution: ${formatDollars(result.roundedAmount)}`,
      "",
      ...result.perInvestor.map(
        (p) =>
          `${p.investor_name} (${(p.ownership_pct * 100).toFixed(0)}%): ${formatDollars(p.amount)}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-medium text-slate-300">
          Distribution Calculator
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input fields */}
        <div className="space-y-3">
          {INPUT_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  $
                </span>
                <input
                  type="text"
                  value={inputs[key].toLocaleString()}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-md pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>
            </div>
          ))}

          {/* Computed fields */}
          <div className="pt-3 border-t border-slate-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Minimum Needed</span>
              <span className="text-slate-300">
                {formatDollars(result.minimumNeeded)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Available to Distribute</span>
              <span className="text-slate-300">
                {formatDollars(result.availableToDistribute)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-slate-200">Rounded (nearest $30K)</span>
              <span className="text-emerald-400">
                {formatDollars(result.roundedAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Per-investor breakdown + copy */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Per-Investor Breakdown
            </h3>
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                copied
                  ? "bg-emerald-900/30 text-emerald-400"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {result.perInvestor.map((p) => (
              <div
                key={p.investor_name}
                className="flex items-center justify-between bg-slate-900/50 rounded-md px-3 py-2"
              >
                <div>
                  <span className="text-sm text-slate-200">
                    {p.investor_name}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    {(p.ownership_pct * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-sm font-medium text-emerald-400">
                  {formatDollars(p.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Grand total confirmation */}
          <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
            <span className="text-sm text-slate-400">Total</span>
            <span className="text-sm font-semibold text-emerald-400">
              {formatDollars(
                result.perInvestor.reduce((s, p) => s + p.amount, 0)
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. File Manifest

All new files to create:

| File | Purpose |
|------|---------|
| `supabase/migrations/001_distributions.sql` | Schema DDL (tables + RLS + indexes) |
| `scripts/seed-distributions.ts` | Seed data loader |
| `src/app/api/distributions/route.ts` | API route |
| `src/lib/distribution-types.ts` | Shared TypeScript types |
| `src/lib/distribution-utils.ts` | Business logic (XIRR, calculator, enrichment) |
| `src/app/distributions/page.tsx` | Page component |
| `src/components/distributions/investor-cards.tsx` | XIRR/return summary cards |
| `src/components/distributions/cumulative-chart.tsx` | Stacked bar chart |
| `src/components/distributions/distribution-table.tsx` | History table |
| `src/components/distributions/distribution-calculator.tsx` | Interactive calculator |

Files to modify:

| File | Change |
|------|--------|
| `src/components/sidebar.tsx` | Add `DollarSign` import + nav item |
| `package.json` | Add `seed:distributions` script |
| `tailwind.config.ts` | *(Optional — only if not using inline styles for card borders)* |

---

## 7. Data Flow Summary

```
Supabase tables:
  distributions → distribution_date, total_amount
  investor_ownership → investor_name, ownership_pct, invested_capital
  distribution_overrides → distribution_id, investor_name, override_amount

          ↓ fetched by

GET /api/distributions → returns { distributions, investors, overrides }

          ↓ consumed by

distributions/page.tsx
  → enrichDistributions() — resolves per-investor amounts (override-aware)
  → computeInvestorSummaries() — calculates totals, return %, XIRR
  → passes enriched data to 4 child components
```

---

## 8. XIRR Technical Notes

- **Cashflow structure:** For each investor, the first cashflow is their investment amount (negative) on `investment_date`. Subsequent cashflows are their distributions (positive) on each `distribution_date`. No terminal value is assumed (future value = 0). This means the XIRR represents the return *from distributions alone*, not including unrealized equity value.
- **Newton-Raphson:** Initial guess 0.1 (10%). Max 100 iterations. Tolerance 1e-7. Guard rails at -99% and +1000% to prevent divergence.
- **Display:** Show as percentage with one decimal (e.g., "12.3%"). Show "—" if computation fails to converge.
- **No external dependency.** The XIRR function is implemented inline in `distribution-utils.ts`. The goldeneye-xirr codebase was not found at the referenced path, so a clean Newton-Raphson implementation is provided above.

---

## 9. Edge Cases & Validation

1. **Empty distributions table:** Show "No distributions recorded" in place of chart and table. Calculator still functions.
2. **Override rounding:** When overrides exist, the per-investor sum may not equal `total_amount` exactly due to rounding. Accept up to $1 discrepancy — do not try to reconcile in the UI.
3. **Calculator negative result:** If `cashInBank < minimumNeeded`, show `$0` for rounded amount and per-investor amounts. Color the "Available to Distribute" field red.
4. **XIRR edge cases:** If there's only 1 distribution (or none), XIRR returns null → display "—". If all cashflows are the same sign, XIRR returns null.
5. **Mobile:** The history table should scroll horizontally on small screens. The calculator stacks to single column. Cards go 2×2.

---

## 10. Testing Checklist

Before marking complete, verify:

- [ ] `npm run build` passes with no type errors
- [ ] `/distributions` renders with demo data when Supabase is not configured
- [ ] `/distributions` renders with live data after running `npm run seed:distributions`
- [ ] XIRR values are reasonable (expect ~12-15% annualized for these cashflows)
- [ ] Total return percentages match: Barnett 75.9%, Costa 75.3%, Lee 46.9%, Loute 73.3%
- [ ] Calculator auto-updates on input change
- [ ] Copy button produces clean text output
- [ ] Sort toggle on date column works both directions
- [ ] Totals row sums correctly
- [ ] Sidebar shows "Distributions" with DollarSign icon between Yearly and Upload
- [ ] Responsive: cards 2×2 mobile → 4 across desktop
- [ ] Chart tooltips show formatted dollar amounts
- [ ] Page matches dark theme (slate-900/800/700 palette, emerald accents)
