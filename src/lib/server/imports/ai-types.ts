import type { BudgetCategory } from '$lib/schema/budget';

export const DEFAULT_AI_PROMPT_VERSION = 'v1';
export const DEFAULT_AI_MODEL_LABEL = 'minimax/minimax-m2.7';

export interface AiMerchantInput {
	normalizedDescription: string;
	description: string;
	amount: number;
}

export interface AiCategorizationResult {
	normalizedDescription: string;
	suggestedCategoryId: string | null;
	certainty: number;
}

export interface AiCategorizationInput {
	categories: BudgetCategory[];
	merchants: AiMerchantInput[];
	promptVersion?: string;
}

export interface SingleTransactionAiSuggestionInput {
	categories: BudgetCategory[];
	description: string;
	amount: number;
}

export interface SingleTransactionAiSuggestionResult {
	suggestedCategoryId: string | null;
	certainty: number;
}

export interface SingleTransactionAiDebugResult extends SingleTransactionAiSuggestionResult {
	prompt: string;
	rawResponse: string | null;
	error?: string | null;
}

export type AiCategorizer = (input: AiCategorizationInput) => Promise<AiCategorizationResult[]>;

export type SingleTransactionAiCategorizer = (
	input: SingleTransactionAiSuggestionInput,
) => Promise<SingleTransactionAiSuggestionResult>;
