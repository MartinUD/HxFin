import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as HttpApiClient from '@effect/platform/HttpApiClient';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { FinApi } from '$lib/api/definition';

function getDefaultBaseUrl(): string | undefined {
	if (typeof window !== 'undefined' && window.location?.origin) {
		return window.location.origin;
	}

	return undefined;
}

function makeFetchLayer(fetcher: typeof fetch): Layer.Layer<FetchHttpClient.Fetch> {
	return Layer.succeed(FetchHttpClient.Fetch, fetcher);
}

function makeClientRuntime(fetcher: typeof fetch): Layer.Layer<never, never, FetchHttpClient.Fetch> {
	return makeFetchLayer(fetcher);
}

export const makeApiClient = (
	fetcher: typeof fetch = globalThis.fetch,
	baseUrl: string | URL | undefined = getDefaultBaseUrl()
) =>
	HttpApiClient.make(FinApi, { baseUrl }).pipe(
		Effect.provide(Layer.merge(FetchHttpClient.layer, makeClientRuntime(fetcher)))
	);

export type ApiClient = typeof makeApiClient extends (
	...args: Array<any>
) => Effect.Effect<infer Client, any, any>
	? Client
	: never;

export function withApiClient<A, E, R>(
	fetcher: typeof fetch,
	baseUrlOrFn: string | URL | ((client: ApiClient) => Effect.Effect<A, E, R>) | undefined,
	maybeFn?: (client: ApiClient) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, FetchHttpClient.Fetch | R> {
	const baseUrl =
		typeof baseUrlOrFn === 'function' || baseUrlOrFn === undefined ? undefined : baseUrlOrFn;
	const f =
		typeof baseUrlOrFn === 'function'
			? baseUrlOrFn
			: (maybeFn as (client: ApiClient) => Effect.Effect<A, E, R>);

	return Effect.flatMap(makeApiClient(fetcher, baseUrl), f);
}
