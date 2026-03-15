import db from '$lib/server/db';
import { migrations } from '$lib/server/migrations';

let schemaInitialized = false;

export function ensureSchema(): void {
	if (schemaInitialized) {
		return;
	}

	db.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id TEXT PRIMARY KEY,
			description TEXT NOT NULL,
			applied_at TEXT NOT NULL
		);
	`);

	const appliedRows = db
		.prepare(`SELECT id FROM schema_migrations ORDER BY id ASC`)
		.all() as Array<{ id: string }>;
	const appliedMigrationIds = new Set(appliedRows.map((row) => row.id));

	for (const migration of migrations) {
		if (appliedMigrationIds.has(migration.id)) {
			continue;
		}

		const applyMigration = db.transaction(() => {
			migration.up(db);
			db.prepare(
				`INSERT INTO schema_migrations (id, description, applied_at)
				 VALUES (?, ?, ?)`,
			).run(migration.id, migration.description, new Date().toISOString());
		});

		applyMigration();
	}

	schemaInitialized = true;
}
