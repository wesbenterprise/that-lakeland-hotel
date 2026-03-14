-- SHS Financial Dashboard Schema
-- Run this against your Supabase project

-- Monthly periods - core financial data
CREATE TABLE IF NOT EXISTS monthly_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL,
  year int NOT NULL,
  month int NOT NULL,
  -- Operating Stats
  rooms_available int,
  rooms_sold int,
  occupancy_pct decimal(5,4),
  adr int, -- cents
  revpar int, -- cents
  -- Revenue (PTD Actual, cents)
  room_revenue int,
  fb_revenue int,
  other_operated_revenue int,
  misc_income int,
  total_revenue int,
  -- Departmental Expenses (PTD Actual, cents)
  rooms_expense int,
  fb_expense int,
  other_operated_expense int,
  -- Undistributed Expenses (PTD Actual, cents)
  admin_general int,
  sales_marketing int,
  property_ops_maintenance int,
  utilities int,
  it_telecom int,
  -- Profit Lines (PTD Actual, cents)
  gross_operating_profit int,
  gop_pct decimal(5,4),
  management_fees int,
  property_taxes int,
  insurance int,
  reserve_for_replacement int,
  nop_hotel int,
  nop_pct decimal(5,4),
  -- Budget columns
  room_revenue_budget int,
  fb_revenue_budget int,
  total_revenue_budget int,
  rooms_expense_budget int,
  fb_expense_budget int,
  admin_general_budget int,
  sales_marketing_budget int,
  property_ops_maintenance_budget int,
  utilities_budget int,
  gop_budget int,
  gop_pct_budget decimal(5,4),
  nop_hotel_budget int,
  nop_pct_budget decimal(5,4),
  occupancy_pct_budget decimal(5,4),
  adr_budget int,
  revpar_budget int,
  -- Prior Year
  room_revenue_py int,
  fb_revenue_py int,
  total_revenue_py int,
  gop_py int,
  gop_pct_py decimal(5,4),
  nop_hotel_py int,
  nop_pct_py decimal(5,4),
  occupancy_pct_py decimal(5,4),
  adr_py int,
  revpar_py int,
  -- YTD
  total_revenue_ytd int,
  room_revenue_ytd int,
  gop_ytd int,
  gop_pct_ytd decimal(5,4),
  nop_hotel_ytd int,
  nop_pct_ytd decimal(5,4),
  total_revenue_ytd_budget int,
  gop_ytd_budget int,
  nop_hotel_ytd_budget int,
  -- Metadata
  source_file text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_period UNIQUE (period)
);

CREATE INDEX IF NOT EXISTS idx_monthly_periods_year_month ON monthly_periods (year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_periods_period ON monthly_periods (period);

-- Balance sheet snapshots
CREATE TABLE IF NOT EXISTS balance_sheet_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period date NOT NULL UNIQUE,
  cash_and_equivalents int,
  accounts_receivable int,
  total_current_assets int,
  property_and_equipment_net int,
  total_assets int,
  accounts_payable int,
  total_current_liabilities int,
  long_term_debt int,
  total_liabilities int,
  owners_equity int,
  total_liabilities_and_equity int,
  created_at timestamptz DEFAULT now()
);

-- Upload log
CREATE TABLE IF NOT EXISTS upload_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_type text NOT NULL,
  periods_affected date[],
  row_count int DEFAULT 0,
  uploaded_by text,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'success',
  error_notes text
);

-- RLS policies
ALTER TABLE monthly_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can read monthly_periods" ON monthly_periods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert monthly_periods" ON monthly_periods
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update monthly_periods" ON monthly_periods
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read balance_sheet_snapshots" ON balance_sheet_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert balance_sheet_snapshots" ON balance_sheet_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read upload_log" ON upload_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert upload_log" ON upload_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Also allow service role (for backfill script)
CREATE POLICY "Service role full access monthly_periods" ON monthly_periods
  FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access balance_sheet_snapshots" ON balance_sheet_snapshots
  FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access upload_log" ON upload_log
  FOR ALL TO service_role USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_periods_updated_at
  BEFORE UPDATE ON monthly_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
