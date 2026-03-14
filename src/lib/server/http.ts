import { json } from '@sveltejs/kit';
import type { ZodType } from 'zod';

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: unknown;

	constructor(status: number, code: string, message: string, details?: unknown) {
		super(message);
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export async function readJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON');
	}
}

export function validateWithSchema<T>(schema: ZodType<T>, payload: unknown): T {
	const parsed = schema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', parsed.error.flatten());
	}

	return parsed.data;
}

export function ok<T>(payload: T): Response {
	return json(payload);
}

export function created<T>(payload: T): Response {
	return json(payload, { status: 201 });
}

export function noContent(): Response {
	return new Response(null, { status: 204 });
}

export function handleApiError(error: unknown): Response {
	if (error instanceof ApiError) {
		return json(
			{
				error: {
					code: error.code,
					message: error.message,
					details: error.details
				}
			},
			{ status: error.status }
		);
	}

	console.error(error);

	return json(
		{
			error: {
				code: 'INTERNAL_ERROR',
				message: 'Internal server error'
			}
		},
		{ status: 500 }
	);
}
