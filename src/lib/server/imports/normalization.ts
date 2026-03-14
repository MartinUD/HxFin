function stripDiacritics(input: string): string {
	return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function removeKnownPrefixes(value: string): string {
	let output = value;
	const patterns = [
		/^kortk[oö]p\s+\d{6}\s+/i,
		/^swish\s+betalning\s+/i,
		/^swish\s+inbetalning\s+/i,
		/^autogiro\s+/i,
		/^betalning\s+bg\s+\S+\s+/i
	];

	for (const pattern of patterns) {
		output = output.replace(pattern, '');
	}

	return output;
}

export function normalizeMerchantDescription(description: string): string {
	const trimmed = description.trim();
	if (trimmed.length === 0) {
		return 'unknown';
	}

	const withoutPrefixes = removeKnownPrefixes(trimmed);
	const ascii = stripDiacritics(withoutPrefixes.toLowerCase());
	const alphanumeric = ascii.replace(/[^a-z0-9]+/g, ' ').trim();
	const collapsed = alphanumeric.replace(/\s+/g, ' ');

	return collapsed.length > 0 ? collapsed : 'unknown';
}
