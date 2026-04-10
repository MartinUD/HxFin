import type { BudgetCategory } from '$lib/schema/budget';

export const DEFAULT_CODEX_PROMPT_VERSION = 'v2';
export const DEFAULT_CODEX_MODEL_LABEL = 'codex-cli';

export interface CodexMerchantInput {
	normalizedDescription: string;
	description: string;
}

export interface CodexCategorizationResult {
	normalizedDescription: string;
	suggestedCategoryId: string | null;
	confidence: number;
	reason: string | null;
	isCertain: boolean;
}

export interface CodexCategorizationInput {
	categories: BudgetCategory[];
	merchants: CodexMerchantInput[];
	promptVersion?: string;
}

export interface SingleTransactionCodexSuggestionInput {
	categories: BudgetCategory[];
	description: string;
	amount: number;
}

export interface SingleTransactionCodexSuggestionResult {
	suggestedCategoryId: string | null;
	reason: string | null;
	confidence: number;
}

export interface SingleTransactionCodexDebugResult extends SingleTransactionCodexSuggestionResult {
	prompt: string;
	rawResponse: string;
}

export type CodexCategorizer = (
	input: CodexCategorizationInput,
) => Promise<CodexCategorizationResult[]>;

export type SingleTransactionCodexCategorizer = (
	input: SingleTransactionCodexSuggestionInput,
) => Promise<SingleTransactionCodexSuggestionResult>;
