import { registerHooks } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const aliasEntries = [
	['$lib/', path.join(projectRoot, 'src', 'lib') + path.sep]
];

function resolveAliasTarget(basePath) {
	if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
		return basePath;
	}

	const candidates = [
		`${basePath}.ts`,
		`${basePath}.js`,
		path.join(basePath, 'index.ts'),
		path.join(basePath, 'index.js')
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return basePath;
}

registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, targetPath] of aliasEntries) {
			if (specifier.startsWith(prefix)) {
				const relativePath = specifier.slice(prefix.length).replaceAll('/', path.sep);
				const resolvedPath = resolveAliasTarget(path.join(targetPath, relativePath));
				return nextResolve(pathToFileURL(resolvedPath).href, context);
			}
		}

		return nextResolve(specifier, context);
	}
});
