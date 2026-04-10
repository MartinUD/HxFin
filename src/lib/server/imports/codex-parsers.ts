import type { BudgetCategory } from '$lib/schema/budget';
import type { CodexCategorizationResult } from '$lib/server/imports/codex-types';

function clampConfidence(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.max(0, Math.min(1, value));
}

function normalizePlainText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[`"'*.!?,:;()[\]{}]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeCategoryName(value: string): string {
	return normalizePlainText(value);
}

function extractSingleLineResponse(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length === 0) {
		return '';
	}

	const fencedMatch = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
	const unfenced = fencedMatch?.[1]?.trim() ?? trimmed;
	const firstNonEmptyLine =
		unfenced
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find((line) => line.length > 0) ?? '';

	return firstNonEmptyLine.replace(/^["'`]+|["'`]+$/g, '').trim();
}

function extractJsonObjectCandidate(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		return trimmed;
	}

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		const fencedContent = fencedMatch[1].trim();
		if (fencedContent.startsWith('{') && fencedContent.endsWith('}')) {
			return fencedContent;
		}
	}

	const firstBraceIndex = trimmed.indexOf('{');
	if (firstBraceIndex === -1) {
		throw new SyntaxError('Codex response did not include a JSON object');
	}

	let depth = 0;
	let inString = false;
	let escaping = false;

	for (let index = firstBraceIndex; index < trimmed.length; index += 1) {
		const character = trimmed[index];

		if (inString) {
			if (escaping) {
				escaping = false;
				continue;
			}

			if (character === '\\') {
				escaping = true;
				continue;
			}

			if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			continue;
		}

		if (character === '{') {
			depth += 1;
			continue;
		}

		if (character === '}') {
			depth -= 1;
			if (depth === 0) {
				return trimmed.slice(firstBraceIndex, index + 1);
			}
		}
	}

	throw new SyntaxError('Codex response did not contain a complete JSON object');
}

function extractJsonArrayCandidate(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		return trimmed;
	}

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		const fencedContent = fencedMatch[1].trim();
		if (fencedContent.startsWith('[') && fencedContent.endsWith(']')) {
			return fencedContent;
		}
	}

	const firstBracketIndex = trimmed.indexOf('[');
	if (firstBracketIndex === -1) {
		throw new SyntaxError('Codex response did not include a JSON array');
	}

	let depth = 0;
	let inString = false;
	let escaping = false;

	for (let index = firstBracketIndex; index < trimmed.length; index += 1) {
		const character = trimmed[index];

		if (inString) {
			if (escaping) {
				escaping = false;
				continue;
			}

			if (character === '\\') {
				escaping = true;
				continue;
			}

			if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			continue;
		}

		if (character === '[') {
			depth += 1;
			continue;
		}

		if (character === ']') {
			depth -= 1;
			if (depth === 0) {
				return trimmed.slice(firstBracketIndex, index + 1);
			}
		}
	}

	throw new SyntaxError('Codex response did not contain a complete JSON array');
}

export function parseCodexCategorizationResponse(input: {
	text: string;
	allowedCategoryIds: Set<string>;
	merchantKeys: Set<string>;
	categories?: Array<{ id: string; name: string }>;
}): CodexCategorizationResult[] {
	let parsed: unknown = null;
	try {
		const trimmed = input.text.trim();
		parsed = JSON.parse(
			trimmed.startsWith('[')
				? extractJsonArrayCandidate(input.text)
				: extractJsonObjectCandidate(input.text),
		) as unknown;
	} catch (error) {
		if (input.categories && input.categories.length > 0) {
			try {
				const parsedArray = JSON.parse(extractJsonArrayCandidate(input.text)) as unknown;
				if (Array.isArray(parsedArray)) {
					return parseCategoryArrayResponse({
						items: parsedArray,
						merchantKeys: input.merchantKeys,
						categories: input.categories,
					});
				}
			} catch {
				// keep falling through to single-merchant plain-text fallback
			}
		}

		if (input.merchantKeys.size === 1 && input.categories && input.categories.length > 0) {
			const merchantKey = Array.from(input.merchantKeys)[0];
			const normalizedResponse = normalizePlainText(input.text);

			if (
				normalizedResponse === 'null' ||
				normalizedResponse === 'none' ||
				normalizedResponse === 'needs review' ||
				normalizedResponse.includes('uncertain') ||
				normalizedResponse.includes('not sure') ||
				normalizedResponse.includes('cannot determine') ||
				normalizedResponse.includes('unknown')
			) {
				return [
					{
						normalizedDescription: merchantKey,
						suggestedCategoryId: null,
						confidence: 0,
						reason: 'Parsed uncertain plain-text Codex response',
						isCertain: false,
					},
				];
			}

			const matchingCategories = input.categories.filter(
				(category) =>
					normalizedResponse.includes(normalizePlainText(category.name)) ||
					normalizedResponse.includes(normalizePlainText(category.id)),
			);
			if (matchingCategories.length === 1) {
				return [
					{
						normalizedDescription: merchantKey,
						suggestedCategoryId: matchingCategories[0].id,
						confidence: 0.55,
						reason: 'Parsed plain-text Codex response',
						isCertain: false,
					},
				];
			}
		}

		throw error;
	}

	if (Array.isArray(parsed) && input.categories && input.categories.length > 0) {
		return parseCategoryArrayResponse({
			items: parsed,
			merchantKeys: input.merchantKeys,
			categories: input.categories,
		});
	}

	if (
		!parsed ||
		typeof parsed !== 'object' ||
		!('results' in parsed) ||
		!Array.isArray(parsed.results)
	) {
		throw new Error('Codex response did not include a results array');
	}

	const seen = new Set<string>();
	const results: CodexCategorizationResult[] = [];

	for (const item of parsed.results) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const normalizedDescription =
			'normalizedDescription' in item && typeof item.normalizedDescription === 'string'
				? item.normalizedDescription
				: null;
		if (
			!normalizedDescription ||
			!input.merchantKeys.has(normalizedDescription) ||
			seen.has(normalizedDescription)
		) {
			continue;
		}

		const suggestedCategoryId =
			'suggestedCategoryId' in item && typeof item.suggestedCategoryId === 'string'
				? item.suggestedCategoryId
				: item.suggestedCategoryId === null
					? null
					: null;
		if (suggestedCategoryId && !input.allowedCategoryIds.has(suggestedCategoryId)) {
			continue;
		}

		const confidence =
			'confidence' in item && typeof item.confidence === 'number'
				? clampConfidence(item.confidence)
				: 0;
		const reason =
			'reason' in item && typeof item.reason === 'string'
				? item.reason.trim() || null
				: item.reason === null
					? null
					: null;
		const isCertain =
			'isCertain' in item && typeof item.isCertain === 'boolean' ? item.isCertain : false;

		results.push({
			normalizedDescription,
			suggestedCategoryId,
			confidence,
			reason,
			isCertain,
		});
		seen.add(normalizedDescription);
	}

	return results;
}

function parseCategoryArrayResponse(input: {
	items: unknown[];
	merchantKeys: Set<string>;
	categories: Array<{ id: string; name: string }>;
}): CodexCategorizationResult[] {
	const seen = new Set<string>();
	const results: CodexCategorizationResult[] = [];

	for (const item of input.items) {
		if (!item || typeof item !== 'object') {
			continue;
		}

		const normalizedDescription =
			'normalizedDescription' in item && typeof item.normalizedDescription === 'string'
				? item.normalizedDescription
				: null;
		if (
			!normalizedDescription ||
			!input.merchantKeys.has(normalizedDescription) ||
			seen.has(normalizedDescription)
		) {
			continue;
		}

		const categoryName =
			'category' in item && typeof item.category === 'string' ? item.category : null;
		const normalizedCategory = categoryName ? normalizeCategoryName(categoryName) : '';
		const matchedCategory = input.categories.find(
			(category) => normalizeCategoryName(category.name) === normalizedCategory,
		);

		results.push({
			normalizedDescription,
			suggestedCategoryId:
				normalizedCategory === 'unknown' || !matchedCategory ? null : matchedCategory.id,
			confidence: normalizedCategory === 'unknown' ? 0 : matchedCategory ? 0.85 : 0,
			reason: 'Parsed category-name Codex response',
			isCertain: false,
		});
		seen.add(normalizedDescription);
	}

	return results;
}

export function parseSingleTransactionCategoryResponse(input: {
	text: string;
	categories: BudgetCategory[];
}): {
	suggestedCategoryId: string | null;
	reason: string | null;
	confidence: number;
} {
	const line = extractSingleLineResponse(input.text);
	const normalizedResponse = normalizeCategoryName(line);

	if (
		normalizedResponse.length === 0 ||
		normalizedResponse === 'unknown' ||
		normalizedResponse === 'none' ||
		normalizedResponse === 'null' ||
		normalizedResponse.includes('not sure') ||
		normalizedResponse.includes('uncertain') ||
		normalizedResponse.includes('cannot determine')
	) {
		return {
			suggestedCategoryId: null,
			reason: 'Codex returned no clear category',
			confidence: 0,
		};
	}

	const matches = input.categories.filter(
		(category) =>
			normalizedResponse === normalizeCategoryName(category.name) ||
			normalizedResponse.includes(normalizeCategoryName(category.name)) ||
			normalizeCategoryName(category.name).includes(normalizedResponse),
	);

	if (matches.length !== 1) {
		return {
			suggestedCategoryId: null,
			reason: 'Codex returned an ambiguous category name',
			confidence: 0,
		};
	}

	return {
		suggestedCategoryId: matches[0].id,
		reason: 'Parsed single-category Codex response',
		confidence: 0.65,
	};
}
