import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ApiClientError, requestJson, type ApiFetcher } from '../src/lib/api/http.ts';

function createFetcher(response: Response): ApiFetcher {
	return async () => response;
}

describe('requestJson', () => {
	it('returns parsed payload for successful responses', async () => {
		const fetcher = createFetcher(
			new Response(JSON.stringify({ ok: true, value: 42 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		const payload = await requestJson<{ ok: boolean; value: number }>(fetcher, '/test');

		assert.equal(payload.ok, true);
		assert.equal(payload.value, 42);
	});

	it('returns undefined for 204 responses', async () => {
		const fetcher = createFetcher(new Response(null, { status: 204 }));
		const payload = await requestJson<void>(fetcher, '/test');

		assert.equal(payload, undefined);
	});

	it('parses nested API error envelopes', async () => {
		const fetcher = createFetcher(
			new Response(
				JSON.stringify({
					error: {
						code: 'VALIDATION_ERROR',
						message: 'Request validation failed',
						details: { field: 'name' }
					}
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		await assert.rejects(
			() => requestJson(fetcher, '/test'),
			(error: unknown) =>
				error instanceof ApiClientError &&
				error.code === 'VALIDATION_ERROR' &&
				error.message === 'Request validation failed' &&
				error.status === 400
		);
	});

	it('falls back to top-level error shape when nested error is missing', async () => {
		const fetcher = createFetcher(
			new Response(JSON.stringify({ code: 'HTTP_FAIL', message: 'Failed' }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await assert.rejects(
			() => requestJson(fetcher, '/test'),
			(error: unknown) =>
				error instanceof ApiClientError &&
				error.code === 'HTTP_FAIL' &&
				error.message === 'Failed' &&
				error.status === 502
		);
	});
});
