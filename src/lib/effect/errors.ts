import * as HttpApiSchema from '@effect/platform/HttpApiSchema';
import * as Schema from 'effect/Schema';

const DetailsSchema = Schema.optional(Schema.Unknown);

export const ValidationErrorSchema = Schema.TaggedStruct('ValidationError', {
	code: Schema.String,
	message: Schema.String,
	details: DetailsSchema,
}).annotations(HttpApiSchema.annotations({ status: 400 }));

export type ValidationError = Schema.Schema.Type<typeof ValidationErrorSchema>;

export const NotFoundErrorSchema = Schema.TaggedStruct('NotFoundError', {
	code: Schema.String,
	message: Schema.String,
}).annotations(HttpApiSchema.annotations({ status: 404 }));

export type NotFoundError = Schema.Schema.Type<typeof NotFoundErrorSchema>;

export const ConflictErrorSchema = Schema.TaggedStruct('ConflictError', {
	code: Schema.String,
	message: Schema.String,
}).annotations(HttpApiSchema.annotations({ status: 409 }));

export type ConflictError = Schema.Schema.Type<typeof ConflictErrorSchema>;

export const PersistenceErrorSchema = Schema.TaggedStruct('PersistenceError', {
	code: Schema.String,
	message: Schema.String,
}).annotations(HttpApiSchema.annotations({ status: 500 }));

export type PersistenceError = Schema.Schema.Type<typeof PersistenceErrorSchema>;

export const ExternalServiceErrorSchema = Schema.TaggedStruct('ExternalServiceError', {
	code: Schema.String,
	message: Schema.String,
}).annotations(HttpApiSchema.annotations({ status: 502 }));

export type ExternalServiceError = Schema.Schema.Type<typeof ExternalServiceErrorSchema>;

export const InternalErrorSchema = Schema.TaggedStruct('InternalError', {
	code: Schema.String,
	message: Schema.String,
}).annotations(HttpApiSchema.annotations({ status: 500 }));

export type InternalError = Schema.Schema.Type<typeof InternalErrorSchema>;

export const AppErrorSchema = Schema.Union(
	ValidationErrorSchema,
	NotFoundErrorSchema,
	ConflictErrorSchema,
	PersistenceErrorSchema,
	ExternalServiceErrorSchema,
	InternalErrorSchema,
);

export type AppError = Schema.Schema.Type<typeof AppErrorSchema>;

export function validationError(
	message: string,
	details?: unknown,
	code = 'VALIDATION_ERROR',
): ValidationError {
	return details === undefined
		? { _tag: 'ValidationError', code, message }
		: { _tag: 'ValidationError', code, message, details };
}

export function notFoundError(message: string, code = 'NOT_FOUND'): NotFoundError {
	return { _tag: 'NotFoundError', code, message };
}

export function conflictError(message: string, code = 'CONFLICT'): ConflictError {
	return { _tag: 'ConflictError', code, message };
}

export function persistenceError(message: string, code = 'PERSISTENCE_ERROR'): PersistenceError {
	return { _tag: 'PersistenceError', code, message };
}

export function externalServiceError(
	message: string,
	code = 'EXTERNAL_SERVICE_ERROR',
): ExternalServiceError {
	return { _tag: 'ExternalServiceError', code, message };
}

export function internalError(
	message = 'Internal server error',
	code = 'INTERNAL_ERROR',
): InternalError {
	return { _tag: 'InternalError', code, message };
}

export function toUserMessage(error: unknown, fallback: string): string {
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}

	return fallback;
}
