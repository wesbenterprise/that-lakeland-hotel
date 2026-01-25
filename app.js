/**
 * XIRR Calculator Application
 * Main application logic for the XIRR calculator interface
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const investmentDateInput = document.getElementById('investmentDate');
    const investmentAmountInput = document.getElementById('investmentAmount');
    const distributionsList = document.getElementById('distributionsList');
    const addDistributionBtn = document.getElementById('addDistribution');
    const calculateBtn = document.getElementById('calculateXIRR');
    const clearAllBtn = document.getElementById('clearAll');
    const loadSampleBtn = document.getElementById('loadSample');
    const resultsSection = document.getElementById('resultsSection');
    const cashFlowsSection = document.getElementById('cashFlowsSection');

    let distributionCount = 0;

    // Sample data from the spreadsheet (Lakeland Hotel Investment)
    // Using TOTAL row data
    const sampleData = {
        total: {
            investment: {
                date: '2022-04-01',
                amount: 7000000  // $7,000,000 invested capital
            },
            distributions: [
                { date: '2022-04-01', amount: 450000 },
                { date: '2022-10-01', amount: 450000 },
                { date: '2023-06-01', amount: 1080000 },
                { date: '2023-10-01', amount: 540000 },
                { date: '2024-04-01', amount: 900000 },
                { date: '2024-12-01', amount: 510000 },
                { date: '2025-05-01', amount: 1200000 },
                { date: '2025-12-01', amount: 2000000 + 5130000 }  // Final distribution + remaining value
            ]
        },
        barnett: {
            investment: {
                date: '2022-04-01',
                amount: 4430000
            },
            distributions: [
                { date: '2022-04-01', amount: 306000 },
                { date: '2022-10-01', amount: 306000 },
                { date: '2023-06-01', amount: 702000 },
                { date: '2023-10-01', amount: 351000 },
                { date: '2024-04-01', amount: 585000 },
                { date: '2024-12-01', amount: 331500 },
                { date: '2025-05-01', amount: 780000 },
                { date: '2025-12-01', amount: 1300000 + 3361500 }
            ]
        },
        costa: {
            investment: {
                date: '2022-04-01',
                amount: 1850000
            },
            distributions: [
                { date: '2022-04-01', amount: 126000 },
                { date: '2022-10-01', amount: 126000 },
                { date: '2023-06-01', amount: 291600 },
                { date: '2023-10-01', amount: 145800 },
                { date: '2024-04-01', amount: 243000 },
                { date: '2024-12-01', amount: 137700 },
                { date: '2025-05-01', amount: 324000 },
                { date: '2025-12-01', amount: 540000 + 1394100 }
            ]
        },
        lee: {
            investment: {
                date: '2022-04-01',
                amount: 580000
            },
            distributions: [
                { date: '2022-04-01', amount: 9000 },
                { date: '2022-10-01', amount: 9000 },
                { date: '2023-06-01', amount: 64800 },
                { date: '2023-10-01', amount: 32400 },
                { date: '2024-04-01', amount: 54000 },
                { date: '2024-12-01', amount: 30600 },
                { date: '2025-05-01', amount: 72000 },
                { date: '2025-12-01', amount: 120000 + 271800 }
            ]
        },
        loute: {
            investment: {
                date: '2022-04-01',
                amount: 140000
            },
            distributions: [
                { date: '2022-04-01', amount: 9000 },
                { date: '2022-10-01', amount: 9000 },
                { date: '2023-06-01', amount: 21600 },
                { date: '2023-10-01', amount: 10800 },
                { date: '2024-04-01', amount: 18000 },
                { date: '2024-12-01', amount: 10200 },
                { date: '2025-05-01', amount: 24000 },
                { date: '2025-12-01', amount: 40000 + 102600 }
            ]
        }
    };

    /**
     * Add a new distribution row to the form
     */
    function addDistributionRow(date = '', amount = '') {
        distributionCount++;
        const row = document.createElement('div');
        row.className = 'distribution-row';
        row.dataset.id = distributionCount;

        row.innerHTML = `
            <input type="date" class="dist-date" value="${date}" placeholder="Date">
            <input type="number" class="dist-amount" value="${amount}" placeholder="Amount" step="0.01">
            <button type="button" class="btn btn-danger remove-dist" title="Remove">×</button>
        `;

        distributionsList.appendChild(row);

        // Add remove handler
        row.querySelector('.remove-dist').addEventListener('click', function() {
            row.remove();
        });
    }

    /**
     * Get all cash flows from the form
     */
    function getCashFlows() {
        const cashFlows = [];

        // Get investment (negative cash flow)
        const investmentDate = investmentDateInput.value;
        const investmentAmount = parseFloat(investmentAmountInput.value);

        if (investmentDate && !isNaN(investmentAmount) && investmentAmount > 0) {
            cashFlows.push({
                date: new Date(investmentDate),
                amount: -investmentAmount,
                type: 'Investment'
            });
        }

        // Get distributions (positive cash flows)
        const rows = distributionsList.querySelectorAll('.distribution-row');
        rows.forEach(row => {
            const date = row.querySelector('.dist-date').value;
            const amount = parseFloat(row.querySelector('.dist-amount').value);

            if (date && !isNaN(amount) && amount !== 0) {
                cashFlows.push({
                    date: new Date(date),
                    amount: amount,
                    type: 'Distribution'
                });
            }
        });

        // Sort by date
        cashFlows.sort((a, b) => a.date - b.date);

        return cashFlows;
    }

    /**
     * Calculate and display XIRR
     */
    function calculate() {
        try {
            const cashFlows = getCashFlows();

            if (cashFlows.length < 2) {
                alert('Please enter an investment amount and at least one distribution.');
                return;
            }

            // Calculate XIRR
            const xirr = XIRR.calculate(cashFlows);

            // Calculate totals
            const totalInvested = Math.abs(cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + cf.amount, 0));
            const totalDistributions = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
            const moic = totalDistributions / totalInvested;

            // Display results
            document.getElementById('xirrResult').textContent = XIRR.formatPercentage(xirr);
            document.getElementById('totalInvested').textContent = formatCurrency(totalInvested);
            document.getElementById('totalDistributions').textContent = formatCurrency(totalDistributions);
            document.getElementById('moic').textContent = moic.toFixed(2) + 'x';

            resultsSection.style.display = 'block';

            // Display cash flow table
            displayCashFlows(cashFlows);
            cashFlowsSection.style.display = 'block';

            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert('Error calculating XIRR: ' + error.message);
        }
    }

    /**
     * Display cash flows in a table
     */
    function displayCashFlows(cashFlows) {
        const tbody = document.getElementById('cashFlowsBody');
        tbody.innerHTML = '';

        cashFlows.forEach(cf => {
            const row = document.createElement('tr');
            const isNegative = cf.amount < 0;

            row.innerHTML = `
                <td>${formatDate(cf.date)}</td>
                <td class="${isNegative ? 'cash-flow-negative' : 'cash-flow-positive'}">
                    ${formatCurrency(cf.amount)}
                </td>
                <td>${cf.type}</td>
            `;

            tbody.appendChild(row);
        });
    }

    /**
     * Format a number as currency
     */
    function formatCurrency(amount) {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        return formatter.format(amount);
    }

    /**
     * Format a date
     */
    function formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Clear all form inputs
     */
    function clearAll() {
        investmentAmountInput.value = '';
        investmentDateInput.value = '2022-04-01';
        distributionsList.innerHTML = '';
        distributionCount = 0;
        resultsSection.style.display = 'none';
        cashFlowsSection.style.display = 'none';

        // Add a few empty rows
        for (let i = 0; i < 3; i++) {
            addDistributionRow();
        }
    }

    /**
     * Load sample data from the spreadsheet
     */
    function loadSample() {
        // Show investor selection
        const investor = prompt(
            'Enter investor name to load data:\n' +
            '- total (Full investment)\n' +
            '- barnett\n' +
            '- costa\n' +
            '- lee\n' +
            '- loute',
            'total'
        );

        if (!investor) return;

        const data = sampleData[investor.toLowerCase()];
        if (!data) {
            alert('Unknown investor. Please enter: total, barnett, costa, lee, or loute');
            return;
        }

        // Clear existing data
        distributionsList.innerHTML = '';
        distributionCount = 0;

        // Load investment
        investmentDateInput.value = data.investment.date;
        investmentAmountInput.value = data.investment.amount;

        // Load distributions
        data.distributions.forEach(dist => {
            addDistributionRow(dist.date, dist.amount);
        });
    }

    // Event Listeners
    addDistributionBtn.addEventListener('click', () => addDistributionRow());
    calculateBtn.addEventListener('click', calculate);
    clearAllBtn.addEventListener('click', clearAll);
    loadSampleBtn.addEventListener('click', loadSample);

    // Initialize with a few empty distribution rows
    for (let i = 0; i < 3; i++) {
        addDistributionRow();
    }
});
