import db, { type SqlParams } from '$lib/server/db';
import { DEFAULT_FINANCIAL_PROFILE_INPUT } from '$lib/contracts/finance';
import { ensureSchema } from '$lib/server/schema';
import type { FinancialProfile, UpdateFinancialProfileInput } from '$lib/server/finance/types';

interface FinancialProfileRow {
	id: string;
	monthly_salary: number;
	salary_growth: number;
	municipal_tax_rate: number;
	savings_share_of_raise: number;
	currency: string;
	created_at: string;
	updated_at: string;
}

const DEFAULT_PROFILE_ID = 'default';

function ensureReady(): void {
	ensureSchema();
}

function nowIso(): string {
	return new Date().toISOString();
}

function mapFinancialProfile(row: FinancialProfileRow): FinancialProfile {
	return {
		id: row.id,
		monthlySalary: row.monthly_salary,
		salaryGrowth: row.salary_growth,
		municipalTaxRate: row.municipal_tax_rate,
		savingsShareOfRaise: row.savings_share_of_raise,
		currency: row.currency,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function getFinancialProfileRow(): FinancialProfileRow | null {
	const row = db
		.prepare(
			`SELECT id, monthly_salary, salary_growth, municipal_tax_rate, savings_share_of_raise, currency, created_at, updated_at
			 FROM financial_profile
			 WHERE id = ?`
		)
		.get(DEFAULT_PROFILE_ID) as FinancialProfileRow | undefined;

	return row ?? null;
}

function ensureProfileExists(): void {
	const existing = getFinancialProfileRow();
	if (existing) {
		return;
	}

	const timestamp = nowIso();
	db.prepare(
		`INSERT INTO financial_profile (
			id,
			monthly_salary,
			salary_growth,
			municipal_tax_rate,
			savings_share_of_raise,
			currency,
			created_at,
			updated_at
		) VALUES (
			@id,
			@monthlySalary,
			@salaryGrowth,
			@municipalTaxRate,
			@savingsShareOfRaise,
			@currency,
			@createdAt,
			@updatedAt
		)`
	).run({
		id: DEFAULT_PROFILE_ID,
		monthlySalary: DEFAULT_FINANCIAL_PROFILE_INPUT.monthlySalary,
		salaryGrowth: DEFAULT_FINANCIAL_PROFILE_INPUT.salaryGrowth,
		municipalTaxRate: DEFAULT_FINANCIAL_PROFILE_INPUT.municipalTaxRate,
		savingsShareOfRaise: DEFAULT_FINANCIAL_PROFILE_INPUT.savingsShareOfRaise,
		currency: DEFAULT_FINANCIAL_PROFILE_INPUT.currency,
		createdAt: timestamp,
		updatedAt: timestamp
	});
}

export function getFinancialProfile(): FinancialProfile {
	ensureReady();
	ensureProfileExists();

	const row = getFinancialProfileRow();
	if (!row) {
		throw new Error('Failed to load financial profile');
	}

	return mapFinancialProfile(row);
}

export function updateFinancialProfile(input: UpdateFinancialProfileInput): FinancialProfile {
	ensureReady();
	ensureProfileExists();

	const fields: string[] = [];
	const params: SqlParams = { id: DEFAULT_PROFILE_ID };

	if (input.monthlySalary !== undefined) {
		fields.push('monthly_salary = @monthlySalary');
		params.monthlySalary = input.monthlySalary;
	}

	if (input.salaryGrowth !== undefined) {
		fields.push('salary_growth = @salaryGrowth');
		params.salaryGrowth = input.salaryGrowth;
	}

	if (input.municipalTaxRate !== undefined) {
		fields.push('municipal_tax_rate = @municipalTaxRate');
		params.municipalTaxRate = input.municipalTaxRate;
	}

	if (input.savingsShareOfRaise !== undefined) {
		fields.push('savings_share_of_raise = @savingsShareOfRaise');
		params.savingsShareOfRaise = input.savingsShareOfRaise;
	}

	if (input.currency !== undefined) {
		fields.push('currency = @currency');
		params.currency = input.currency;
	}

	fields.push('updated_at = @updatedAt');
	params.updatedAt = nowIso();

	db.prepare(
		`UPDATE financial_profile
		 SET ${fields.join(', ')}
		 WHERE id = @id`
	).run(params);

	return getFinancialProfile();
}
