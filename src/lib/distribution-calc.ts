import { CalculatorInputs, CalculatorResult } from './types';
import { INVESTORS, ROUNDING_INCREMENT } from './distribution-constants';

export function calculateDistribution(inputs: CalculatorInputs): CalculatorResult {
  const { cash_in_bank, operating_buffer, reserve_balance, restricted_funds, future_reserves } = inputs;

  const minimum_needed = operating_buffer + reserve_balance + restricted_funds + future_reserves;
  const to_distribute_raw = Math.max(0, cash_in_bank - minimum_needed);
  const to_distribute_rounded = Math.floor(to_distribute_raw / ROUNDING_INCREMENT) * ROUNDING_INCREMENT;
  const remaining_in_bank = cash_in_bank - to_distribute_rounded;
  const buffer = remaining_in_bank - minimum_needed;

  const per_investor = INVESTORS.map(investor => {
    const amount = to_distribute_rounded * investor.current_pct;
    const invested_capital_dollars = investor.invested_capital / 100;
    const yield_pct = invested_capital_dollars > 0 ? amount / invested_capital_dollars : 0;

    return {
      key: investor.key,
      name: investor.name,
      pct: investor.current_pct,
      amount,
      yield_pct,
    };
  });

  return {
    minimum_needed,
    to_distribute_raw,
    to_distribute_rounded,
    remaining_in_bank,
    buffer,
    per_investor,
  };
}
