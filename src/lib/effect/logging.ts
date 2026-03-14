export interface LogContext {
	readonly module: string;
	readonly operation: string;
	readonly details?: unknown;
}

export function logInfo(context: LogContext): void {
	console.info(`[${context.module}] ${context.operation}`, context.details ?? '');
}

export function logError(context: LogContext, error: unknown): void {
	console.error(`[${context.module}] ${context.operation}`, context.details ?? '', error);
}
