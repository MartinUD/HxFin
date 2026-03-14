import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './drizzle',
	schema: './src/lib/server/drizzle/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.BUDGET_DB_PATH ?? 'data/budget.db'
	}
});
