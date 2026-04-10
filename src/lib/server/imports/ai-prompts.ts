import type {
	AiCategorizationInput,
	SingleTransactionAiSuggestionInput,
} from '$lib/server/imports/ai-types';

export function buildAiCategorizationSystemPrompt(): string {
	return [
		'You categorize bank transactions into one of the provided category IDs.',
		'Return only JSON that matches the requested schema exactly.',
		'For each result, copy normalizedDescription exactly from the input merchants list.',
		'certainty must be an integer from 0 to 100, not a decimal.',
		'Be conservative.',
		'If uncertain, set categoryId to null and certainty to 0.',
		'Do not invent category IDs.',
		'Do not echo the input payload.',
		'Do not include category names, explanations, or extra fields.',
	].join(' ');
}

export function buildAiCategorizationUserPayload(input: AiCategorizationInput): string {
	return JSON.stringify({
		promptVersion: input.promptVersion ?? 'v1',
		categories: input.categories.map((category) => ({
			id: category.id,
			name: category.name,
		})),
		merchants: input.merchants.map((merchant) => ({
			normalizedDescription: merchant.normalizedDescription,
			description: merchant.description,
			amount: merchant.amount,
		})),
	});
}

export function buildSingleTransactionAiSystemPrompt(): string {
	return 'You categorize one bank transaction into one of the provided category IDs. Return only JSON that matches the requested schema exactly. Be conservative. If uncertain, set categoryId to null and certainty to 0. Do not invent category IDs. Do not echo the input payload. Do not include category names, explanations, or extra fields.';
}

export function buildSingleTransactionAiUserPayload(
	input: SingleTransactionAiSuggestionInput,
): string {
	return JSON.stringify({
		categories: input.categories.map((category) => ({
			id: category.id,
			name: category.name,
		})),
		transaction: {
			description: input.description,
			amount: input.amount,
		},
	});
}
