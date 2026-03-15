import { ensureSchema } from '$lib/server/schema';

export function ensureReady(): void {
	ensureSchema();
}

export function nowIso(): string {
	return new Date().toISOString();
}
