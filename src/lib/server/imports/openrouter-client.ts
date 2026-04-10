export interface OpenRouterChatCompletionInput {
	body: string;
	timeoutMs: number;
}

export interface OpenRouterChatCompletionResult {
	content: string;
	rawResponse: string;
}

export async function createOpenRouterChatCompletion(
	input: OpenRouterChatCompletionInput,
): Promise<OpenRouterChatCompletionResult> {
	const apiKey = process.env.OPENROUTER_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('OPENROUTER_API_KEY is not configured');
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: input.body,
			signal: controller.signal,
		});
		const rawResponse = await response.text();

		if (!response.ok) {
			if (
				response.status === 404 &&
				rawResponse.includes('guardrail restrictions and data policy')
			) {
				throw new Error(
					'OpenRouter blocked the request because your account privacy settings do not allow any providers for this free model. Open OpenRouter Settings > Privacy and relax the data policy for free-provider routing, then try again.',
				);
			}

			throw new Error(
				`OpenRouter request failed with status ${response.status}: ${rawResponse.slice(0, 500)}`,
			);
		}

		const parsed = JSON.parse(rawResponse) as {
			error?: { message?: string; code?: number | string };
			choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
		};

		if (parsed.error?.message) {
			throw new Error(
				`OpenRouter provider error${
					parsed.error.code !== undefined ? ` (${parsed.error.code})` : ''
				}: ${parsed.error.message}`,
			);
		}
		const content = parsed.choices?.[0]?.message?.content;

		if (typeof content === 'string') {
			return {
				content,
				rawResponse,
			};
		}

		if (Array.isArray(content)) {
			const text = content
				.filter((item) => item?.type === 'text' && typeof item.text === 'string')
				.map((item) => item.text)
				.join('');
			if (text.length > 0) {
				return {
					content: text,
					rawResponse,
				};
			}
		}

		throw new Error('OpenRouter response did not include message content');
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`OpenRouter request timed out after ${input.timeoutMs}ms`);
		}

		throw error;
	} finally {
		clearTimeout(timeout);
	}
}
