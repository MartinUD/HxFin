import { Database, type SQLQueryBindings } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.cwd(), process.env.BUDGET_DB_PATH ?? 'data/budget.db');
mkdirSync(dirname(databasePath), { recursive: true });

const db = new Database(databasePath, {
	create: true,
	strict: true,
});
db.exec('PRAGMA foreign_keys = ON;');

export type AppDatabase = Database;
export type SqlParams = Extract<SQLQueryBindings, Record<string, unknown>>;

export function getDatabasePath(): string {
	return databasePath;
}

export default db;
