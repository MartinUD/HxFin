const DEFAULT_LOCALE = 'sv-SE';

export function formatLocalizedNumber(
	value: number,
	options: Intl.NumberFormatOptions = {},
): string {
	return new Intl.NumberFormat(DEFAULT_LOCALE, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
		...options,
	}).format(value);
}

export function formatSekCurrency(value: number): string {
	return new Intl.NumberFormat(DEFAULT_LOCALE, {
		style: 'currency',
		currency: 'SEK',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatSekAmount(value: number): string {
	return `${formatLocalizedNumber(Math.round(value))} kr`;
}
