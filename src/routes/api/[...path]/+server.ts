import { handleApiRequest } from '$lib/server/api';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request }) => handleApiRequest(request);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
