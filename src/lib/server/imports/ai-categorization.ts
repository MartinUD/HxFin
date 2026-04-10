import { z } from 'zod';

import type { BudgetCategory } from '$lib/schema/budget';
import {
	buildAiCategorizationSystemPrompt,
	buildAiCategorizationUserPayload,
	buildSingleTransactionAiSystemPrompt,
	buildSingleTransactionAiUserPayload,
} from '$lib/server/imports/ai-prompts';
import { createOpenRouterChatCompletion } from '$lib/server/imports/openrouter-client';
import type {
	AiCategorizationInput,
	AiCategorizationResult,
	AiCategorizer,
	SingleTransactionAiCategorizer,
	SingleTransactionAiDebugResult,
	SingleTransactionAiSuggestionInput,
	SingleTransactionAiSuggestionResult,
} from '$lib/server/imports/ai-types';

export {
	DEFAULT_AI_MODEL_LABEL,
	DEFAULT_AI_PROMPT_VERSION,
	type AiCategorizationInput,
	type AiCategorizationResult,
	type AiCategorizer,
	type AiMerchantInput,
	type SingleTransactionAiCategorizer,
	type SingleTransactionAiDebugResult,
	type SingleTransactionAiSuggestionInput,
	type SingleTransactionAiSuggestionResult,
} from '$lib/server/imports/ai-types';
export {
	buildAiCategorizationSystemPrompt,
	buildAiCategorizationUserPayload,
	buildSingleTransactionAiSystemPrompt,
	buildSingleTransactionAiUserPayload,
} from '$lib/server/imports/ai-prompts';

const batchResultItemSchema = z.object({
	normalizedDescription: z.string().min(1),
	categoryId: z.string().min(1).nullable(),
	certainty: z.number().int().min(0).max(100),
});

const rawBatchResultItemSchema = z.object({
	normalizedDescription: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
	categoryId: z.string().min(1).nullable(),
	certainty: z.number().min(0).max(100),
});

const batchResponseObjectSchema = z.object({
	results: z.array(rawBatchResultItemSchema),
});

const batchResponseArraySchema = z.array(rawBatchResultItemSchema);

const singleResponseSchema = z.object({
	categoryId: z.string().min(1).nullable(),
	certainty: z.number().int().min(0).max(100),
});

function extractJsonPayload(text: string): string {
	const trimmed = text.trim();
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		return trimmed;
	}

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		return fencedMatch[1].trim();
	}

	const objectStart = trimmed.indexOf('{');
	const arrayStart = trimmed.indexOf('[');
	const start =
		objectStart === -1
			? arrayStart
			: arrayStart === -1
				? objectStart
				: Math.min(objectStart, arrayStart);

	if (start === -1) {
		return trimmed;
	}

	return trimmed.slice(start).trim();
}

function buildBatchSchema(): object {
	return {
		name: 'import_categorization',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				results: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							normalizedDescription: { type: 'string' },
							categoryId: {
								anyOf: [{ type: 'string' }, { type: 'null' }],
							},
							certainty: {
								type: 'integer',
								minimum: 0,
								maximum: 100,
							},
						},
						required: ['normalizedDescription', 'categoryId', 'certainty'],
						additionalProperties: false,
					},
				},
			},
			required: ['results'],
			additionalProperties: false,
		},
	};
}

function buildSingleSchema(): object {
	return {
		name: 'single_import_categorization',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				categoryId: {
					anyOf: [{ type: 'string' }, { type: 'null' }],
				},
				certainty: {
					type: 'integer',
					minimum: 0,
					maximum: 100,
				},
			},
			required: ['categoryId', 'certainty'],
			additionalProperties: false,
		},
	};
}

function normalizeCertainty(certainty: number): number {
	if (certainty <= 1) {
		return Math.max(0, Math.min(100, Math.round(certainty * 100)));
	}

	return Math.max(0, Math.min(100, Math.round(certainty)));
}

export function parseBatchResponse(
	text: string,
	merchants: Array<{ normalizedDescription: string; description: string }>,
): Array<z.infer<typeof batchResultItemSchema>> {
	const parsedJson = JSON.parse(extractJsonPayload(text));
	const objectResult = batchResponseObjectSchema.safeParse(parsedJson);
	const arrayResult = batchResponseArraySchema.safeParse(parsedJson);
	const rawItems = objectResult.success
		? objectResult.data.results
		: arrayResult.success
			? arrayResult.data
			: null;

	if (rawItems) {
		const descriptionToNormalized = new Map(
			merchants.map((merchant) => [merchant.description, merchant.normalizedDescription]),
		);

		return rawItems.flatMap((item) => {
			const normalizedDescription =
				item.normalizedDescription ?? (item.description ? descriptionToNormalized.get(item.description) : undefined);
			if (!normalizedDescription) {
				return [];
			}

			return [
				{
					normalizedDescription,
					categoryId: item.categoryId,
					certainty: item.categoryId ? normalizeCertainty(item.certainty) : 0,
				},
			];
		});
	}

	if (Array.isArray(parsedJson)) {
		throw arrayResult.error;
	}

	throw objectResult.error;
}

function buildBatchRequestBody(input: AiCategorizationInput): string {
	return JSON.stringify({
		model: process.env.OPENROUTER_MODEL?.trim() || 'minimax/minimax-m2.7',
		temperature: 0,
		stream: false,
		messages: [
			{
				role: 'system',
				content: buildAiCategorizationSystemPrompt(),
			},
			{
				role: 'user',
				content: buildAiCategorizationUserPayload(input),
			},
		],
		response_format: {
			type: 'json_schema',
			json_schema: buildBatchSchema(),
		},
	});
}

function buildSingleRequestBody(input: SingleTransactionAiSuggestionInput): string {
	return JSON.stringify({
		model: process.env.OPENROUTER_MODEL?.trim() || 'minimax/minimax-m2.7',
		temperature: 0,
		stream: false,
		messages: [
			{
				role: 'system',
				content: buildSingleTransactionAiSystemPrompt(),
			},
			{
				role: 'user',
				content: buildSingleTransactionAiUserPayload(input),
			},
		],
		response_format: {
			type: 'json_schema',
			json_schema: buildSingleSchema(),
		},
	});
}

function estimateRequestTokens(body: string): number {
	return Math.ceil(body.length / 4);
}

function shouldSplitRequest(body: string): boolean {
	const reservedTokens = 18000;
	const safeCap = 170000;
	return estimateRequestTokens(body) + reservedTokens > safeCap;
}

function isSplittableRequestError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes('timed out') ||
		message.includes('context') ||
		message.includes('413') ||
		message.includes('too large') ||
		message.includes('maximum context length')
	);
}

function toValidCategoryId(categoryId: string | null, categories: BudgetCategory[]): string | null {
	if (!categoryId) {
		return null;
	}

	return categories.some((category) => category.id === categoryId) ? categoryId : null;
}

async function runBatch(input: AiCategorizationInput): Promise<AiCategorizationResult[]> {
	const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? '60000');
	const body = buildBatchRequestBody(input);
	const merchantKeys = new Set(input.merchants.map((merchant) => merchant.normalizedDescription));
	const categories = input.categories;

	const { content } = await createOpenRouterChatCompletion({
		body,
		timeoutMs,
	});
	let parsedResults: Array<z.infer<typeof batchResultItemSchema>>;
	try {
		parsedResults = parseBatchResponse(content, input.merchants);
	} catch (error) {
		console.warn('AI batch response parse failed.', {
			rawContent: content.slice(0, 4000),
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
	const seen = new Set<string>();
	const results: AiCategorizationResult[] = [];

	for (const item of parsedResults) {
		if (!merchantKeys.has(item.normalizedDescription) || seen.has(item.normalizedDescription)) {
			continue;
		}

		results.push({
			normalizedDescription: item.normalizedDescription,
			suggestedCategoryId: toValidCategoryId(item.categoryId, categories),
			certainty: item.categoryId ? item.certainty : 0,
		});
		seen.add(item.normalizedDescription);
	}

	return results;
}

async function runBatchWithFallback(
	input: AiCategorizationInput,
): Promise<AiCategorizationResult[]> {
	const body = buildBatchRequestBody(input);
	if (input.merchants.length > 1 && shouldSplitRequest(body)) {
		const midpoint = Math.ceil(input.merchants.length / 2);
		const left = await runBatchWithFallback({
			...input,
			merchants: input.merchants.slice(0, midpoint),
		});
		const right = await runBatchWithFallback({
			...input,
			merchants: input.merchants.slice(midpoint),
		});
		return [...left, ...right];
	}

	try {
		return await runBatch(input);
	} catch (error) {
		if (!isSplittableRequestError(error) || input.merchants.length <= 1) {
			throw error;
		}

		const midpoint = Math.ceil(input.merchants.length / 2);
		const left = await runBatchWithFallback({
			...input,
			merchants: input.merchants.slice(0, midpoint),
		});
		const right = await runBatchWithFallback({
			...input,
			merchants: input.merchants.slice(midpoint),
		});
		return [...left, ...right];
	}
}

export const categorizeMerchantsWithAi: AiCategorizer = async (input) => {
	if (input.merchants.length === 0) {
		return [];
	}

	return runBatchWithFallback(input);
};

export const suggestSingleTransactionCategoryWithAi: SingleTransactionAiCategorizer = async (
	input,
) => {
	const result = await suggestSingleTransactionCategoryWithAiDebug(input);
	return {
		suggestedCategoryId: result.suggestedCategoryId,
		certainty: result.certainty,
	};
};

export async function suggestSingleTransactionCategoryWithAiDebug(
	input: SingleTransactionAiSuggestionInput,
): Promise<SingleTransactionAiDebugResult> {
	const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? '60000');
	const prompt = buildSingleTransactionAiUserPayload(input);
	const body = buildSingleRequestBody(input);
	const { content } = await createOpenRouterChatCompletion({
		body,
		timeoutMs,
	});
	const parsed = singleResponseSchema.parse(JSON.parse(extractJsonPayload(content)));

	return {
		suggestedCategoryId: toValidCategoryId(parsed.categoryId, input.categories),
		certainty: parsed.categoryId ? parsed.certainty : 0,
		prompt,
		rawResponse: content,
	};
}
