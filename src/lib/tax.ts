// Swedish progressive tax calculation (2024 brackets)
// Kommunalskatt average ~32.41%
// Statlig inkomstskatt: 20% on income above 598 500 kr/year (49 875 kr/month)

const DEFAULT_KOMMUNALSKATT = 32.41;
const STATLIG_SKATT_RATE = 20;
const STATLIG_SKATT_BREAKPOINT_YEARLY = 598500; // 2024

export interface TaxResult {
	grossMonthly: number;
	netMonthly: number;
	totalTaxMonthly: number;
	effectiveTaxRate: number;
	marginalTaxRate: number;
}

export function calculateSwedishTax(
	grossMonthlySalary: number,
	kommunalskatt: number = DEFAULT_KOMMUNALSKATT
): TaxResult {
	const grossYearly = grossMonthlySalary * 12;

	// Grundavdrag (basic deduction) - simplified 2024 model
	// For income ~200k-600k the grundavdrag is roughly 16 800 kr/year
	// This is a simplified approximation
	let grundavdrag: number;
	if (grossYearly <= 0) {
		grundavdrag = 0;
	} else if (grossYearly <= 46200) {
		grundavdrag = grossYearly;
	} else if (grossYearly <= 150600) {
		grundavdrag = 46200;
	} else if (grossYearly <= 385400) {
		grundavdrag = 46200 - 0.1 * (grossYearly - 150600);
	} else if (grossYearly <= 519300) {
		grundavdrag = 22700;
	} else {
		grundavdrag = Math.max(16800, 22700 - 0.05 * (grossYearly - 519300));
	}

	const taxableIncome = Math.max(0, grossYearly - grundavdrag);

	// Kommunal skatt on taxable income
	const kommunalTax = taxableIncome * (kommunalskatt / 100);

	// Statlig inkomstskatt on income above breakpoint (no grundavdrag applied here - it's on gross)
	const statligBase = Math.max(0, grossYearly - STATLIG_SKATT_BREAKPOINT_YEARLY);
	const statligTax = statligBase * (STATLIG_SKATT_RATE / 100);

	// Jobbskatteavdrag (simplified model for working age people)
	let jobbskatteavdrag: number;
	const baseForJsa = taxableIncome;
	const pbb = 57300; // prisbasbelopp 2024

	if (baseForJsa <= 0.91 * pbb) {
		jobbskatteavdrag = baseForJsa * (kommunalskatt / 100);
	} else if (baseForJsa <= 3.24 * pbb) {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(baseForJsa - 0.91 * pbb) * 0.332;
	} else if (baseForJsa <= 8.08 * pbb) {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(3.24 * pbb - 0.91 * pbb) * 0.332 +
			(baseForJsa - 3.24 * pbb) * 0.111;
	} else {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(3.24 * pbb - 0.91 * pbb) * 0.332 +
			(8.08 * pbb - 3.24 * pbb) * 0.111;
	}

	const totalTaxYearly = Math.max(0, kommunalTax + statligTax - jobbskatteavdrag);
	const totalTaxMonthly = totalTaxYearly / 12;
	const netMonthly = grossMonthlySalary - totalTaxMonthly;

	const effectiveTaxRate =
		grossMonthlySalary > 0 ? (totalTaxMonthly / grossMonthlySalary) * 100 : 0;

	// Marginal tax rate: tax on the next 100 kr
	const marginalGross = grossMonthlySalary + 100;
	const marginalResult = calculateSwedishTaxSimple(marginalGross, kommunalskatt);
	const marginalNet = marginalGross - marginalResult;
	const marginalTaxRate =
		grossMonthlySalary > 0 ? ((100 - (marginalNet - netMonthly)) / 100) * 100 : 0;

	return {
		grossMonthly: grossMonthlySalary,
		netMonthly: Math.round(netMonthly),
		totalTaxMonthly: Math.round(totalTaxMonthly),
		effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
		marginalTaxRate: Math.round(marginalTaxRate * 10) / 10
	};
}

// Simplified version that just returns monthly tax (used for marginal calc to avoid recursion)
function calculateSwedishTaxSimple(
	grossMonthlySalary: number,
	kommunalskatt: number
): number {
	const grossYearly = grossMonthlySalary * 12;

	let grundavdrag: number;
	if (grossYearly <= 0) {
		grundavdrag = 0;
	} else if (grossYearly <= 46200) {
		grundavdrag = grossYearly;
	} else if (grossYearly <= 150600) {
		grundavdrag = 46200;
	} else if (grossYearly <= 385400) {
		grundavdrag = 46200 - 0.1 * (grossYearly - 150600);
	} else if (grossYearly <= 519300) {
		grundavdrag = 22700;
	} else {
		grundavdrag = Math.max(16800, 22700 - 0.05 * (grossYearly - 519300));
	}

	const taxableIncome = Math.max(0, grossYearly - grundavdrag);
	const kommunalTax = taxableIncome * (kommunalskatt / 100);
	const statligBase = Math.max(0, grossYearly - STATLIG_SKATT_BREAKPOINT_YEARLY);
	const statligTax = statligBase * (STATLIG_SKATT_RATE / 100);

	const pbb = 57300;
	const baseForJsa = taxableIncome;
	let jobbskatteavdrag: number;

	if (baseForJsa <= 0.91 * pbb) {
		jobbskatteavdrag = baseForJsa * (kommunalskatt / 100);
	} else if (baseForJsa <= 3.24 * pbb) {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(baseForJsa - 0.91 * pbb) * 0.332;
	} else if (baseForJsa <= 8.08 * pbb) {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(3.24 * pbb - 0.91 * pbb) * 0.332 +
			(baseForJsa - 3.24 * pbb) * 0.111;
	} else {
		jobbskatteavdrag =
			0.91 * pbb * (kommunalskatt / 100) +
			(3.24 * pbb - 0.91 * pbb) * 0.332 +
			(8.08 * pbb - 3.24 * pbb) * 0.111;
	}

	return Math.max(0, kommunalTax + statligTax - jobbskatteavdrag) / 12;
}

// Calculate how much net income changes when gross changes
export function netRaiseFromGrossRaise(
	currentGrossMonthly: number,
	grossRaiseMonthly: number,
	kommunalskatt: number = DEFAULT_KOMMUNALSKATT
): number {
	const currentNet = calculateSwedishTax(currentGrossMonthly, kommunalskatt).netMonthly;
	const newNet = calculateSwedishTax(
		currentGrossMonthly + grossRaiseMonthly,
		kommunalskatt
	).netMonthly;
	return newNet - currentNet;
}
