import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	if (chunkSize <= 0) {
		return [items];
	}

	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}

	return chunks;
}

function buildDirectCodexCommand(input: {
	finalMessagePath: string;
	prompt: string;
	json: boolean;
}): string[] {
	const command = ['codex', 'exec', '--skip-git-repo-check'];
	if (input.json) {
		command.push('--json');
	}
	command.push('--output-last-message', input.finalMessagePath, input.prompt);
	return command;
}

function buildPowerShellCodexCommand(input: {
	finalMessagePath: string;
	prompt: string;
}): string[] {
	const escapeSingleQuoted = (value: string) => value.replace(/'/g, "''");
	const script = [
		`$finalMessagePath = '${escapeSingleQuoted(input.finalMessagePath)}'`,
		`$prompt = @'`,
		input.prompt,
		`'@`,
		'codex exec --output-last-message $finalMessagePath $prompt',
	].join('\n');

	return ['powershell', '-NoProfile', '-Command', script];
}

export async function runCodexPrompt(
	prompt: string,
	timeoutMs: number,
	options: { json?: boolean; debugLabel?: string; invocation?: 'direct' | 'powershell' } = {},
): Promise<string> {
	const runDir = await mkdtemp(join(tmpdir(), 'fin-codex-imports-'));
	const finalMessagePath = join(runDir, 'final-message.txt');
	const invocation = options.invocation ?? 'direct';
	const command =
		invocation === 'powershell'
			? buildPowerShellCodexCommand({
					finalMessagePath,
					prompt,
				})
			: buildDirectCodexCommand({
					finalMessagePath,
					prompt,
					json: options.json !== false,
				});

	if (options.debugLabel) {
		console.log(`[codex-debug:${options.debugLabel}] starting codex exec`, {
			cwd: process.cwd(),
			command,
			timeoutMs,
			prompt,
		});
	}

	try {
		const proc = Bun.spawn(command, {
			cwd: process.cwd(),
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const timeout = new Promise<never>((_, reject) => {
			const timer = setTimeout(() => {
				proc.kill();
				reject(new Error(`Codex categorization timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			proc.exited.finally(() => clearTimeout(timer));
		});

		const stdoutTextPromise = new Response(proc.stdout).text();
		const stderrTextPromise = new Response(proc.stderr).text();
		const exitCode = await Promise.race([proc.exited, timeout]);
		const [stdoutText, stderrText, finalMessage] = await Promise.all([
			stdoutTextPromise,
			stderrTextPromise,
			readFile(finalMessagePath, 'utf8'),
		]);

		if (options.debugLabel) {
			console.log(`[codex-debug:${options.debugLabel}] codex exec finished`, {
				exitCode,
				stdout: stdoutText,
				stderr: stderrText,
				finalMessage,
			});
		}

		if (exitCode !== 0) {
			throw new Error(
				`Codex categorization failed with exit code ${exitCode}: ${
					stderrText.trim() || stdoutText.trim() || 'unknown error'
				}`,
			);
		}

		return finalMessage;
	} finally {
		await rm(runDir, { recursive: true, force: true });
	}
}

export function isTimeoutError(error: unknown): boolean {
	return error instanceof Error && error.message.toLowerCase().includes('timed out');
}

export function batchItems<T>(items: T[], chunkSize: number): T[][] {
	return chunkArray(items, chunkSize);
}
