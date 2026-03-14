# SHS Lakeland Dashboard — Status

## What's Built (v1)

### Pages
- **Overview** (`/`) — KPI cards (Occupancy, ADR, RevPAR, Total Revenue, GOP, NOP), revenue composition chart, RevPAR trend, income statement summary table, period selector
- **Trends** (`/trends`) — Multi-metric time series chart (Recharts), metric checkboxes grouped by Revenue/Profitability/Operating Stats, date range presets (TTM/YTD/2-Year/All), budget + prior year overlay toggles
- **Month Detail** (`/month/[period]`) — Full USALI v11 income statement with columns: PTD Actual | PTD Budget | Variance $ | Variance % | Prior Year | YTD Actual | YTD Budget. Color-coded variance cells. Operating stats sidebar. Prev/Next month navigation.
- **Upload** (`/upload`) — Drag-and-drop XLSX zone, parse preview table, confirm/submit to Supabase

### API Routes
- `POST /api/upload` — Receives XLSX, parses via McKibbon parser, returns preview JSON. On confirm, upserts to Supabase.
- `GET /api/periods` — Returns all monthly_periods for charts

### Infrastructure
- **Supabase schema** at `supabase/schema.sql` — monthly_periods, balance_sheet_snapshots, upload_log tables
- **XLSX parser** at `src/lib/xlsx-parser.ts` with McKibbon mapping config
- **PDF parser** at `src/lib/pdf-parser.ts` (secondary, for when only PDFs are available)
- **Demo mode** — fully functional with synthetic data when Supabase credentials aren't configured
- **Auth** — Supabase Auth with demo-mode bypass
- **Dark theme** — slate-900 background, emerald/red variance colors
- **Left sidebar** navigation

### Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Supabase, Lucide icons
- Deployment: Vercel (auto-deploy from GitHub main)

## Blockers

### 🔴 Supabase Project Not Created
No Supabase project exists for this dashboard yet. Currently runs in **demo mode** with synthetic data. To go live:
1. Create a Supabase project
2. Run `supabase/schema.sql` to create tables
3. Add credentials to `.env.local` (see `.env.local.example`)
4. Add same credentials to Vercel environment variables

## v2 Items
- Budget vs. Actual page with waterfall chart
- Year-over-Year comparison page with multi-year overlay
- Balance Sheet page with cash position chart
- CSV export from any view
- Chart download as PNG
- Historical data backfill script for 68 months of archives

## Live URL
Whatever Vercel assigned to `wesbenterprise/that-lakeland-hotel`
