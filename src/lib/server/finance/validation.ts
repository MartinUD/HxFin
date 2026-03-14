import { z } from 'zod';

import { validateWithSchema } from '$lib/server/http';
import type { UpdateFinancialProfileInput } from '$lib/server/finance/types';

const monthlySalarySchema = z.number().min(0).max(10_000_000);
const salaryGrowthSchema = z.number().min(0).max(100);
const municipalTaxRateSchema = z.number().min(0).max(100);
const savingsShareSchema = z.number().min(0).max(100);
const currencySchema = z.string().trim().toUpperCase().length(3);

const updateFinancialProfileSchema = z
	.object({
		monthlySalary: monthlySalarySchema.optional(),
		salaryGrowth: salaryGrowthSchema.optional(),
		municipalTaxRate: municipalTaxRateSchema.optional(),
		savingsShareOfRaise: savingsShareSchema.optional(),
		currency: currencySchema.optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'At least one financial profile field must be provided'
	});

export function parseUpdateFinancialProfileInput(payload: unknown): UpdateFinancialProfileInput {
	return validateWithSchema(updateFinancialProfileSchema, payload);
}
