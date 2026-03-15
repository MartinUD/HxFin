import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

function makeFetchLayer(fetcher: typeof fetch): Layer.Layer<FetchHttpClient.Fetch> {
	return Layer.succeed(FetchHttpClient.Fetch, fetcher);
}

export function provideBrowserRuntime<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	fetcher: typeof fetch = globalThis.fetch,
): Effect.Effect<A, E, never> {
	return effect.pipe(
		Effect.provide(Layer.merge(FetchHttpClient.layer, makeFetchLayer(fetcher))),
	) as Effect.Effect<A, E, never>;
}

export function runUiEffect<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	fetcher: typeof fetch = globalThis.fetch,
): Promise<A> {
	return Effect.runPromise(provideBrowserRuntime(effect, fetcher));
}
