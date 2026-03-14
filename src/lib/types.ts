export interface MonthlyPeriod {
  id?: string;
  period: string; // date as ISO string
  year: number;
  month: number;
  // Operating Stats
  rooms_available: number | null;
  rooms_sold: number | null;
  occupancy_pct: number | null;
  adr: number | null; // cents
  revpar: number | null; // cents
  // Revenue (cents)
  room_revenue: number | null;
  fb_revenue: number | null;
  other_operated_revenue: number | null;
  misc_income: number | null;
  total_revenue: number | null;
  // Departmental Expenses (cents)
  rooms_expense: number | null;
  fb_expense: number | null;
  other_operated_expense: number | null;
  // Undistributed Expenses (cents)
  admin_general: number | null;
  sales_marketing: number | null;
  property_ops_maintenance: number | null;
  utilities: number | null;
  it_telecom: number | null;
  // Profit Lines (cents)
  gross_operating_profit: number | null;
  gop_pct: number | null;
  management_fees: number | null;
  property_taxes: number | null;
  insurance: number | null;
  reserve_for_replacement: number | null;
  nop_hotel: number | null;
  nop_pct: number | null;
  // Budget columns
  room_revenue_budget: number | null;
  fb_revenue_budget: number | null;
  total_revenue_budget: number | null;
  rooms_expense_budget: number | null;
  fb_expense_budget: number | null;
  admin_general_budget: number | null;
  sales_marketing_budget: number | null;
  property_ops_maintenance_budget: number | null;
  utilities_budget: number | null;
  gop_budget: number | null;
  gop_pct_budget: number | null;
  nop_hotel_budget: number | null;
  nop_pct_budget: number | null;
  occupancy_pct_budget: number | null;
  adr_budget: number | null; // cents
  revpar_budget: number | null; // cents
  // Prior Year
  room_revenue_py: number | null;
  fb_revenue_py: number | null;
  total_revenue_py: number | null;
  gop_py: number | null;
  gop_pct_py: number | null;
  nop_hotel_py: number | null;
  nop_pct_py: number | null;
  occupancy_pct_py: number | null;
  adr_py: number | null;
  revpar_py: number | null;
  // YTD
  total_revenue_ytd: number | null;
  room_revenue_ytd: number | null;
  gop_ytd: number | null;
  gop_pct_ytd: number | null;
  nop_hotel_ytd: number | null;
  nop_pct_ytd: number | null;
  total_revenue_ytd_budget: number | null;
  gop_ytd_budget: number | null;
  nop_hotel_ytd_budget: number | null;
  // Metadata
  source_file: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UploadLog {
  id?: string;
  filename: string;
  file_type: string;
  periods_affected: string[];
  row_count: number;
  uploaded_by: string;
  uploaded_at?: string;
  status: "success" | "partial" | "failed";
  error_notes: string | null;
}
