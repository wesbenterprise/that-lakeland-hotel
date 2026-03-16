import { InvestorProfile } from './types';

/**
 * Investor profiles — invested capital and debt reduction are stored in cents.
 * Current ownership percentages as of the Jun 2023 restructure.
 */
export const INVESTORS: InvestorProfile[] = [
  { key: 'barnett', name: 'Barnett', invested_capital: 443000000, debt_reduction: 130000000, current_pct: 0.65 },
  { key: 'costa',   name: 'Costa',   invested_capital: 185000000, debt_reduction: 54000000,  current_pct: 0.27 },
  { key: 'lee',     name: 'Lee',     invested_capital: 58000000,  debt_reduction: 12000000,  current_pct: 0.06 },
  { key: 'loute',   name: 'Loute',   invested_capital: 14000000,  debt_reduction: 4000000,   current_pct: 0.02 },
];

export const TOTAL_INVESTED_CAPITAL = 700000000;  // $7,000,000 in cents
export const TOTAL_DEBT_REDUCTION = 200000000;     // $2,000,000 in cents

/**
 * Calculator constants
 */
export const DEFAULT_OPERATING_BUFFER = 150000;    // $150,000 (dollars, for UI)
export const ROUNDING_INCREMENT = 30000;           // $30,000 (dollars, for rounding)
