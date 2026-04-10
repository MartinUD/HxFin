import type {
	CodexCategorizationInput,
	SingleTransactionCodexSuggestionInput,
} from '$lib/server/imports/codex-types';
import { DEFAULT_CODEX_PROMPT_VERSION } from '$lib/server/imports/codex-types';

export function buildCodexCategorizationPrompt(input: CodexCategorizationInput): string {
	const categoryNames = input.categories.map((category) => category.name);
	const merchants = input.merchants.map((merchant) => ({
		normalizedDescription: merchant.normalizedDescription,
		description: merchant.description,
	}));

	return [
		'Based from these categories please categorise my purchases output it in json with new category field dont write anything before or after just pure json.',
		`Categories: ${JSON.stringify([...categoryNames, 'UNKNOWN'])}`,
		'For every item keep normalizedDescription and description exactly as provided and add category.',
		`Merchants: ${JSON.stringify(merchants)}`,
		'Output example:',
		'[{"normalizedDescription":"foodora ab","description":"Kortkop 260319 Foodora AB","category":"Food"}]',
	].join(' ');
}

export function buildSingleTransactionCategoryPrompt(
	input: SingleTransactionCodexSuggestionInput,
): string {
	const categoryNames = input.categories.map((category) => category.name).join(', ');

	return `Only reply with exactly one category name from the list or UNKNOWN. Only the category name nothing else.Categories: ${categoryNames} Purchase: ${input.description}, ${Math.abs(input.amount).toFixed(2)}kr`;
}
