import type { RequestHandler } from './$types';

const RUST_BACKEND = 'http://localhost:3001';

// Top-level path segments owned by the Rust backend. A request is forwarded
// when its path equals one of these (e.g. `GET /api/loans`) or is nested
// underneath one (e.g. `GET /api/loans/42`, `PATCH /api/budget/costs/3`).
// Listing bare segments rather than prefix strings prevents a match like
// `loansomething/...` falling through accidentally.
const RUST_SEGMENTS = ['budget', 'loans', 'investments'];

function goesToRust(path: string): boolean {
	return RUST_SEGMENTS.some((segment) => path === segment || path.startsWith(`${segment}/`));
}

const handler: RequestHandler = async ({ request, params }) => {
	const path = (params as Record<string, string>).path ?? '';
	if (goesToRust(path)) {
		const url = new URL(request.url);
		return fetch(`${RUST_BACKEND}/api/${path}${url.search}`, request);
	}
	return new Response(`No backend route for /api/${path}`, { status: 404 });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
