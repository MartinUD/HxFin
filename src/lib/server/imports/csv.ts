import { validationError } from '$lib/effect/errors';

export interface ParsedNordeaCsvRow {
	bookingDate: string;
	amount: number;
	description: string;
	currency: string;
	sender: string | null;
	receiver: string | null;
	balance: number | null;
}

const REQUIRED_HEADERS = [
	'Bokföringsdag',
	'Belopp',
	'Avsändare',
	'Mottagare',
	'Rubrik',
	'Saldo',
	'Valuta'
] as const;

function splitSemicolonLine(line: string): string[] {
	const parts = line.split(';');
	if (parts.length > 0 && parts[parts.length - 1] === '') {
		parts.pop();
	}
	return parts;
}

function parseSwedishNumber(raw: string): number {
	const normalized = raw.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) {
		throw validationError(`Invalid number value: ${raw}`, undefined, 'INVALID_CSV_FORMAT');
	}

	return parsed;
}

function normalizeNullableText(value: string | undefined): string | null {
	if (value === undefined) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parseDate(raw: string): string {
	if (!/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) {
		throw validationError(`Invalid date format: ${raw}`, undefined, 'INVALID_CSV_FORMAT');
	}

	return raw.replace(/\//g, '-');
}

export function parseNordeaTransactionsCsv(csvText: string): ParsedNordeaCsvRow[] {
	const rawText = csvText.replace(/^\uFEFF/, '');
	const lines = rawText
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0);

	if (lines.length < 2) {
		throw validationError(
			'CSV file must contain header and at least one row',
			undefined,
			'INVALID_CSV_FORMAT'
		);
	}

	const headers = splitSemicolonLine(lines[0]);
	const headerIndexByName = new Map<string, number>();
	headers.forEach((header, index) => {
		headerIndexByName.set(header, index);
	});

	for (const required of REQUIRED_HEADERS) {
		if (!headerIndexByName.has(required)) {
			throw validationError(
				`Missing required CSV header: ${required}`,
				undefined,
				'INVALID_CSV_FORMAT'
			);
		}
	}

	const bookingDateIndex = headerIndexByName.get('Bokföringsdag') as number;
	const amountIndex = headerIndexByName.get('Belopp') as number;
	const senderIndex = headerIndexByName.get('Avsändare') as number;
	const receiverIndex = headerIndexByName.get('Mottagare') as number;
	const rubricIndex = headerIndexByName.get('Rubrik') as number;
	const balanceIndex = headerIndexByName.get('Saldo') as number;
	const currencyIndex = headerIndexByName.get('Valuta') as number;

	const rows: ParsedNordeaCsvRow[] = [];

	for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		const columns = splitSemicolonLine(line);
		if (columns.length < headers.length) {
			throw validationError(
				`Row ${lineIndex + 1} has fewer columns than the header`,
				undefined,
				'INVALID_CSV_FORMAT'
			);
		}

		const bookingDateRaw = columns[bookingDateIndex] ?? '';
		const amountRaw = columns[amountIndex] ?? '';
		const rubricRaw = columns[rubricIndex] ?? '';

		if (bookingDateRaw.trim().length === 0 || amountRaw.trim().length === 0 || rubricRaw.trim().length === 0) {
			throw validationError(
				`Row ${lineIndex + 1} is missing required values`,
				undefined,
				'INVALID_CSV_FORMAT'
			);
		}

		rows.push({
			bookingDate: parseDate(bookingDateRaw.trim()),
			amount: parseSwedishNumber(amountRaw.trim()),
			description: rubricRaw.trim(),
			currency: (columns[currencyIndex]?.trim() || 'SEK').toUpperCase(),
			sender: normalizeNullableText(columns[senderIndex]),
			receiver: normalizeNullableText(columns[receiverIndex]),
			balance:
				columns[balanceIndex] && columns[balanceIndex].trim().length > 0
					? parseSwedishNumber(columns[balanceIndex].trim())
					: null
		});
	}

	return rows;
}
