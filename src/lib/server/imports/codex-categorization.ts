import {
	parseCodexCategorizationResponse,
	parseSingleTransactionCategoryResponse,
} from '$lib/server/imports/codex-parsers';
import {
	buildCodexCategorizationPrompt,
	buildSingleTransactionCategoryPrompt,
} from '$lib/server/imports/codex-prompts';
import { batchItems, isTimeoutError, runCodexPrompt } from '$lib/server/imports/codex-runner';
import type {
	CodexCategorizationInput,
	CodexCategorizationResult,
	CodexCategorizer,
	SingleTransactionCodexCategorizer,
	SingleTransactionCodexDebugResult,
	SingleTransactionCodexSuggestionInput,
	SingleTransactionCodexSuggestionResult,
} from '$lib/server/imports/codex-types';

export {
	DEFAULT_CODEX_MODEL_LABEL,
	DEFAULT_CODEX_PROMPT_VERSION,
	type CodexCategorizationInput,
	type CodexCategorizationResult,
	type CodexCategorizer,
	type CodexMerchantInput,
	type SingleTransactionCodexCategorizer,
	type SingleTransactionCodexDebugResult,
	type SingleTransactionCodexSuggestionInput,
	type SingleTransactionCodexSuggestionResult,
} from '$lib/server/imports/codex-types';
export {
	buildCodexCategorizationPrompt,
	buildSingleTransactionCategoryPrompt,
} from '$lib/server/imports/codex-prompts';
export {
	parseCodexCategorizationResponse,
	parseSingleTransactionCategoryResponse,
} from '$lib/server/imports/codex-parsers';

async function runSingleCodexCategorizationBatch(
	input: CodexCategorizationInput,
): Promise<CodexCategorizationResult[]> {
	const prompt = buildCodexCategorizationPrompt(input);
	const timeoutMs = Number(process.env.CODEX_IMPORTS_TIMEOUT_MS ?? '60000');
	const finalMessage = await runCodexPrompt(prompt, timeoutMs);

	return parseCodexCategorizationResponse({
		text: finalMessage,
		allowedCategoryIds: new Set(input.categories.map((category) => category.id)),
		merchantKeys: new Set(input.merchants.map((merchant) => merchant.normalizedDescription)),
		categories: input.categories.map((category) => ({ id: category.id, name: category.name })),
	});
}

async function runCodexBatchWithFallback(
	input: CodexCategorizationInput,
): Promise<CodexCategorizationResult[]> {
	try {
		return await runSingleCodexCategorizationBatch(input);
	} catch (error) {
		if (!isTimeoutError(error) || input.merchants.length <= 1) {
			throw error;
		}

		const midpoint = Math.ceil(input.merchants.length / 2);
		const left = await runCodexBatchWithFallback({
			...input,
			merchants: input.merchants.slice(0, midpoint),
		});
		const right = await runCodexBatchWithFallback({
			...input,
			merchants: input.merchants.slice(midpoint),
		});

		return [...left, ...right];
	}
}

export async function suggestSingleTransactionCategoryWithCodex(
	input: SingleTransactionCodexSuggestionInput,
): Promise<SingleTransactionCodexSuggestionResult> {
	const result = await suggestSingleTransactionCategoryWithCodexDebug(input);

	return {
		suggestedCategoryId: result.suggestedCategoryId,
		reason: result.reason,
		confidence: result.confidence,
	};
}

export async function suggestSingleTransactionCategoryWithCodexDebug(
	input: SingleTransactionCodexSuggestionInput,
): Promise<SingleTransactionCodexDebugResult> {
	if (typeof Bun === 'undefined') {
		throw new Error('Codex categorization requires Bun runtime');
	}

	const timeoutMs = Number(process.env.CODEX_IMPORTS_TIMEOUT_MS ?? '60000');
	const prompt = buildSingleTransactionCategoryPrompt(input);
	const rawResponse = await runCodexPrompt(prompt, timeoutMs, {
		json: false,
		debugLabel: 'single-transaction',
		invocation: 'direct',
	});
	const parsed = parseSingleTransactionCategoryResponse({
		text: rawResponse,
		categories: input.categories,
	});

	console.log('[codex-debug:single-transaction] parsed single transaction response', {
		rawResponse,
		parsed,
	});

	return {
		...parsed,
		prompt,
		rawResponse,
	};
}

export async function categorizeMerchantsWithCodex(
	input: CodexCategorizationInput,
): Promise<CodexCategorizationResult[]> {
	if (input.merchants.length === 0) {
		return [];
	}

	if (typeof Bun === 'undefined') {
		throw new Error('Codex categorization requires Bun runtime');
	}

	const batchSize = Number(process.env.CODEX_IMPORTS_BATCH_SIZE ?? '8');
	const merchantBatches = batchItems(input.merchants, batchSize);
	const results: CodexCategorizationResult[] = [];

	for (const merchants of merchantBatches) {
		const batchResults = await runCodexBatchWithFallback({
			...input,
			merchants,
		});
		results.push(...batchResults);
	}

	return results;
}
