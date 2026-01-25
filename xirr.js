/**
 * XIRR Calculator
 * Calculates Extended Internal Rate of Return using Newton-Raphson method
 */

const XIRR = {
    /**
     * Calculate the number of days between two dates
     * @param {Date} date1
     * @param {Date} date2
     * @returns {number} Days between dates
     */
    daysBetween: function(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return (date2 - date1) / oneDay;
    },

    /**
     * Calculate Net Present Value for a given rate
     * @param {number} rate - The discount rate
     * @param {Array} cashFlows - Array of {date: Date, amount: number}
     * @returns {number} NPV
     */
    npv: function(rate, cashFlows) {
        const firstDate = cashFlows[0].date;
        let npv = 0;

        for (let i = 0; i < cashFlows.length; i++) {
            const cf = cashFlows[i];
            const days = this.daysBetween(firstDate, cf.date);
            const years = days / 365;
            npv += cf.amount / Math.pow(1 + rate, years);
        }

        return npv;
    },

    /**
     * Calculate derivative of NPV for Newton-Raphson
     * @param {number} rate - The discount rate
     * @param {Array} cashFlows - Array of {date: Date, amount: number}
     * @returns {number} Derivative of NPV
     */
    npvDerivative: function(rate, cashFlows) {
        const firstDate = cashFlows[0].date;
        let derivative = 0;

        for (let i = 0; i < cashFlows.length; i++) {
            const cf = cashFlows[i];
            const days = this.daysBetween(firstDate, cf.date);
            const years = days / 365;

            if (years !== 0) {
                derivative -= (years * cf.amount) / Math.pow(1 + rate, years + 1);
            }
        }

        return derivative;
    },

    /**
     * Calculate XIRR using Newton-Raphson method
     * @param {Array} cashFlows - Array of {date: Date, amount: number}
     * @param {number} guess - Initial guess (default 0.1 = 10%)
     * @param {number} tolerance - Acceptable error tolerance
     * @param {number} maxIterations - Maximum iterations
     * @returns {number|null} XIRR as decimal (0.15 = 15%) or null if no solution
     */
    calculate: function(cashFlows, guess = 0.1, tolerance = 1e-7, maxIterations = 1000) {
        // Validate inputs
        if (!cashFlows || cashFlows.length < 2) {
            throw new Error('Need at least 2 cash flows');
        }

        // Sort cash flows by date
        const sortedCashFlows = [...cashFlows].sort((a, b) => a.date - b.date);

        // Check that we have both positive and negative cash flows
        const hasPositive = sortedCashFlows.some(cf => cf.amount > 0);
        const hasNegative = sortedCashFlows.some(cf => cf.amount < 0);

        if (!hasPositive || !hasNegative) {
            throw new Error('Cash flows must include both investments (negative) and returns (positive)');
        }

        let rate = guess;

        // Try Newton-Raphson from different starting points
        const guesses = [guess, -0.5, 0.5, -0.9, 0.9, 0.0, 2.0, -0.99];

        for (const initialGuess of guesses) {
            rate = initialGuess;
            let converged = false;

            for (let i = 0; i < maxIterations; i++) {
                const npv = this.npv(rate, sortedCashFlows);
                const derivative = this.npvDerivative(rate, sortedCashFlows);

                // Check for convergence
                if (Math.abs(npv) < tolerance) {
                    converged = true;
                    break;
                }

                // Avoid division by zero
                if (Math.abs(derivative) < 1e-10) {
                    break;
                }

                // Newton-Raphson iteration
                const newRate = rate - npv / derivative;

                // Check for reasonable bounds
                if (newRate < -0.9999) {
                    rate = -0.9999;
                } else {
                    rate = newRate;
                }

                // Check if rate is exploding
                if (Math.abs(rate) > 10) {
                    break;
                }
            }

            if (converged && rate > -1 && rate < 10) {
                return rate;
            }
        }

        // If Newton-Raphson fails, try bisection method
        return this.bisectionMethod(sortedCashFlows, -0.9999, 10, tolerance, maxIterations);
    },

    /**
     * Bisection method as fallback
     */
    bisectionMethod: function(cashFlows, low, high, tolerance, maxIterations) {
        let npvLow = this.npv(low, cashFlows);
        let npvHigh = this.npv(high, cashFlows);

        // Check if solution exists in range
        if (npvLow * npvHigh > 0) {
            return null;
        }

        for (let i = 0; i < maxIterations; i++) {
            const mid = (low + high) / 2;
            const npvMid = this.npv(mid, cashFlows);

            if (Math.abs(npvMid) < tolerance || (high - low) / 2 < tolerance) {
                return mid;
            }

            if (npvMid * npvLow < 0) {
                high = mid;
                npvHigh = npvMid;
            } else {
                low = mid;
                npvLow = npvMid;
            }
        }

        return (low + high) / 2;
    },

    /**
     * Format XIRR as percentage string
     * @param {number} xirr - XIRR as decimal
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage
     */
    formatPercentage: function(xirr, decimals = 2) {
        if (xirr === null || isNaN(xirr)) {
            return 'N/A';
        }
        return (xirr * 100).toFixed(decimals) + '%';
    }
};

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XIRR;
}
