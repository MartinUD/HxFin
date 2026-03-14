export interface ApiFetcher {
	(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface ApiErrorEnvelope {
	error?: {
		code?: string;
		message?: string;
		details?: unknown;
	};
	code?: string;
	message?: string;
	details?: unknown;
}

export class ApiClientError extends Error {
	constructor(
		message: string,
		public code: string,
		public status: number,
		public details?: unknown
	) {
		super(message);
		this.name = 'ApiClientError';
	}
}

function extractErrorPayload(payload: unknown): {
	message: string;
	code: string;
	details?: unknown;
} {
	if (!payload || typeof payload !== 'object') {
		return {
			message: 'Request failed',
			code: 'HTTP_ERROR'
		};
	}

	const typedPayload = payload as ApiErrorEnvelope;
	const nested = typedPayload.error;
	return {
		message:
			nested?.message ??
			typedPayload.message ??
			'Request failed',
		code:
			nested?.code ??
			typedPayload.code ??
			'HTTP_ERROR',
		details: nested?.details ?? typedPayload.details
	};
}

export async function requestJson<T>(
	fetcher: ApiFetcher,
	input: RequestInfo | URL,
	init?: RequestInit
): Promise<T> {
	const res = await fetcher(input, init);

	if (res.status === 204) {
		return undefined as T;
	}

	const payload = await res.json();

	if (!res.ok) {
		const errorPayload = extractErrorPayload(payload);
		throw new ApiClientError(errorPayload.message, errorPayload.code, res.status, errorPayload.details);
	}

	return payload as T;
}
