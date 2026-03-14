import * as Effect from 'effect/Effect';

export function runServerEffect<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
	return Effect.runPromise(effect as Effect.Effect<A, E, never>);
}
