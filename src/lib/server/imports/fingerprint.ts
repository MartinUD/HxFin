import { createHash } from 'node:crypto';

export function buildImportFingerprint(input: {
	bookingDate: string;
	description: string;
	amount: number;
	currency: string;
}): string {
	return createHash('sha256')
		.update(
			[
				input.bookingDate,
				input.description.trim(),
				input.amount.toFixed(2),
				input.currency.toUpperCase(),
			].join('|'),
		)
		.digest('hex');
}
