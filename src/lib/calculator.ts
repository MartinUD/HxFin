import { netRaiseFromGrossRaise } from './tax';
import { formatLocalizedNumber, formatSekCurrency } from '$lib/finance/format';

export interface CalculatorInputs {
	startCapital: number;
	monthlySaving: number;
	monthlySalary: number;
	salaryGrowth: number;
	kommunalskatt: number;
	savingsShareOfRaise: number;
	avgReturn: number;
	leverage: number;
	years: number;
}

export interface FireInputs {
	retirementYear: number;
	withdrawalRate: number;
}

export interface YearResult {
	year: number;
	startCapital: number;
	monthlyDeposits: number;
	deposits: number;
	returns: number;
	leverageCost: number;
	totalValue: number;
	monthlySaving: number;
	monthlySalary: number;
}

export function getLeverageRate(leveragePercent: number): number {
	if (leveragePercent <= 0) return 0;
	if (leveragePercent <= 10) return 1.29;
	if (leveragePercent <= 25) return 2.34;
	return 3.59;
}

export function getLeverageTier(leveragePercent: number): string {
	if (leveragePercent <= 0) return 'Ingen';
	if (leveragePercent <= 10) return '0-10%';
	if (leveragePercent <= 25) return '10-25%';
	return '25-50%';
}

export function calculate(inputs: CalculatorInputs): YearResult[] {
	const results: YearResult[] = [];
	let totalValue = inputs.startCapital;
	let currentMonthlySaving = inputs.monthlySaving;
	let currentMonthlySalary = inputs.monthlySalary;
	let cumulativeMonthlyDeposits = 0;
	let cumulativeDeposits = inputs.startCapital;
	let cumulativeReturns = 0;
	let cumulativeLeverageCost = 0;

	const monthlyReturn = inputs.avgReturn / 100 / 12;
	const leverageFraction = inputs.leverage / 100;
	const leverageAnnualRate = getLeverageRate(inputs.leverage) / 100;
	const leverageMonthlyRate = leverageAnnualRate / 12;

	for (let year = 1; year <= inputs.years; year++) {
		for (let month = 1; month <= 12; month++) {
			const leveragedAmount = totalValue * leverageFraction;
			const totalExposure = totalValue + leveragedAmount;
			const monthReturn = totalExposure * monthlyReturn;
			cumulativeReturns += monthReturn;

			const leverageCost = leveragedAmount * leverageMonthlyRate;
			cumulativeLeverageCost += leverageCost;

			totalValue += currentMonthlySaving + monthReturn - leverageCost;
			cumulativeMonthlyDeposits += currentMonthlySaving;
			cumulativeDeposits += currentMonthlySaving;
		}

		results.push({
			year,
			startCapital: inputs.startCapital,
			monthlyDeposits: Math.round(cumulativeMonthlyDeposits),
			deposits: Math.round(cumulativeDeposits),
			returns: Math.round(cumulativeReturns),
			leverageCost: Math.round(cumulativeLeverageCost),
			totalValue: Math.round(totalValue),
			monthlySaving: Math.round(currentMonthlySaving),
			monthlySalary: Math.round(currentMonthlySalary)
		});

		// Salary grows, use progressive tax to compute actual net raise
		const grossRaise = currentMonthlySalary * (inputs.salaryGrowth / 100);
		const netRaise = netRaiseFromGrossRaise(
			currentMonthlySalary,
			grossRaise,
			inputs.kommunalskatt
		);
		const savingsIncrease = netRaise * (inputs.savingsShareOfRaise / 100);
		currentMonthlySalary += grossRaise;
		currentMonthlySaving += savingsIncrease;
	}

	return results;
}

export function calculateFireMonthly(
	totalValue: number,
	withdrawalRate: number
): number {
	return Math.round((totalValue * (withdrawalRate / 100)) / 12);
}

export function formatCurrency(value: number): string {
	return formatSekCurrency(value);
}

export function formatNumber(value: number): string {
	return formatLocalizedNumber(value);
}
