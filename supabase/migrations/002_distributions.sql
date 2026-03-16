-- Distributions table - investor distribution history
CREATE TABLE IF NOT EXISTS distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_date date NOT NULL,
  total_amount int NOT NULL,            -- cents (e.g., $450,000 = 45000000)
  barnett_pct decimal(5,4) NOT NULL,    -- e.g., 0.6500 for 65%
  costa_pct decimal(5,4) NOT NULL,      -- e.g., 0.2700 for 27%
  lee_pct decimal(5,4) NOT NULL,        -- e.g., 0.0600 for 6%
  loute_pct decimal(5,4) NOT NULL,      -- e.g., 0.0200 for 2%
  barnett_amount int NOT NULL,          -- cents
  costa_amount int NOT NULL,            -- cents
  lee_amount int NOT NULL,              -- cents
  loute_amount int NOT NULL,            -- cents
  notes text,                           -- optional, e.g., "Q2 distribution"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_distribution_date UNIQUE (distribution_date)
);

CREATE INDEX IF NOT EXISTS idx_distributions_date ON distributions (distribution_date);

-- RLS
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read distributions" ON distributions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert distributions" ON distributions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update distributions" ON distributions
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete distributions" ON distributions
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "Service role full access distributions" ON distributions
  FOR ALL TO service_role USING (true);

-- Updated_at trigger (reuses existing function from 001_initial_schema.sql)
CREATE TRIGGER distributions_updated_at
  BEFORE UPDATE ON distributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Seed data: 7 historical distributions
INSERT INTO distributions (distribution_date, total_amount, barnett_pct, costa_pct, lee_pct, loute_pct, barnett_amount, costa_amount, lee_amount, loute_amount, notes) VALUES
  ('2022-04-01', 45000000, 0.6800, 0.2800, 0.0200, 0.0200, 30600000, 12600000, 900000, 900000, 'Q2 2022 distribution (original ownership split)'),
  ('2022-10-01', 45000000, 0.6800, 0.2800, 0.0200, 0.0200, 30600000, 12600000, 900000, 900000, 'Q4 2022 distribution (original ownership split)'),
  ('2023-06-01', 108000000, 0.6500, 0.2700, 0.0600, 0.0200, 70200000, 29160000, 6480000, 2160000, 'Q2 2023 distribution (revised ownership)'),
  ('2023-10-01', 54000000, 0.6500, 0.2700, 0.0600, 0.0200, 35100000, 14580000, 3240000, 1080000, 'Q4 2023 distribution'),
  ('2024-04-01', 90000000, 0.6500, 0.2700, 0.0600, 0.0200, 58500000, 24300000, 5400000, 1800000, 'Q2 2024 distribution'),
  ('2024-12-01', 51000000, 0.6500, 0.2700, 0.0600, 0.0200, 33150000, 13770000, 3060000, 1220000, 'Q4 2024 distribution'),
  ('2025-05-01', 120000000, 0.6500, 0.2700, 0.0600, 0.0200, 78000000, 32400000, 7200000, 2400000, 'Q2 2025 distribution');
