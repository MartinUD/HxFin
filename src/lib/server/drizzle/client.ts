import { drizzle } from 'drizzle-orm/bun-sqlite';

import sqlite from '$lib/server/db';
import * as schema from '$lib/server/drizzle/schema';

export const orm = drizzle(sqlite, { schema });

export type AppOrm = typeof orm;
