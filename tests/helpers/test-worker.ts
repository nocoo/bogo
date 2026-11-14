import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const root = resolve(import.meta.dirname, "../..");
const wrangler = join(root, "packages/worker/node_modules/.bin/wrangler");

export function testEnvironment(home: string): NodeJS.ProcessEnv {
	return {
		PATH: process.env.PATH,
		HOME: home,
		TMPDIR: tmpdir(),
		CI: "1",
		WRANGLER_SEND_METRICS: "false",
		BUN_CONFIG_REGISTRY: process.env.BUN_CONFIG_REGISTRY,
		NPM_CONFIG_REGISTRY: process.env.NPM_CONFIG_REGISTRY,
	};
}

export async function availablePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((done, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", done);
	});
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Missing test port");
	const port = address.port;
	await new Promise<void>((done, reject) =>
		server.close((error) => (error ? reject(error) : done())),
	);
	return port;
}

export async function waitForHealthyWorker(
	base: string,
	process: ChildProcess,
	logs: () => string,
	timeoutMs = 30_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let last = "No HTTP response";
	while (Date.now() < deadline) {
		if (process.exitCode !== null || process.signalCode !== null) {
			throw new Error(`Test Worker exited (${process.exitCode ?? process.signalCode}): ${logs()}`);
		}
		try {
			const response = await fetch(`${base}/api/live`, { signal: AbortSignal.timeout(1000) });
			const body = (await response.json()) as { status?: string; component?: string };
			if (response.status === 200 && body.status === "ok" && body.component === "worker") return;
			last = `HTTP ${response.status}: ${JSON.stringify(body)}`;
		} catch (error) {
			last = String(error);
		}
		await sleep(100);
	}
	throw new Error(`Test Worker unhealthy at ${base}: ${last}\n${logs()}`);
}

export function createTestWorker() {
	const directory = mkdtempSync(join(tmpdir(), "bogo-test-worker-"));
	const config = join(directory, "wrangler.json");
	const persist = join(directory, "state");
	const env = testEnvironment(directory);
	writeFileSync(
		config,
		JSON.stringify({
			name: "bogo-test",
			main: join(root, "packages/worker/src/index.ts"),
			compatibility_date: "2025-03-14",
			dev: { ip: "127.0.0.1", inspector_port: 0 },
			d1_databases: [
				{
					binding: "DB",
					database_name: "bogo",
					database_id: "00000000-0000-0000-0000-000000000000",
					migrations_dir: join(root, "packages/worker/migrations"),
				},
			],
			assets: {
				directory: join(root, "packages/worker/static"),
				binding: "ASSETS",
				run_worker_first: ["/api/*"],
				not_found_handling: "single-page-application",
			},
			vars: {
				ENVIRONMENT: "test",
				CF_ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
				CF_ACCESS_AUD: "bogo-local-test",
			},
		}),
	);
	let child: ChildProcess | undefined;
	let output = "";
	let stopped = false;
	let initialized = false;
	const args = ["--config", config, "--local", "--persist-to", persist];
	function command(commandArgs: string[]): string {
		const result = spawnSync(wrangler, [...commandArgs, ...args], {
			cwd: directory,
			env,
			encoding: "utf8",
		});
		if (result.error || result.status !== 0) {
			throw new Error(
				`Test Wrangler failed: ${result.error ?? result.status}\n${result.stdout}\n${result.stderr}`,
			);
		}
		return result.stdout;
	}
	function assertMarker() {
		const result = JSON.parse(
			command([
				"d1",
				"execute",
				"bogo",
				"--command",
				"SELECT value FROM _test_marker WHERE key='env'",
				"--json",
			]),
		) as { results: { value: string }[] }[];
		if (result[0]?.results[0]?.value !== "test") throw new Error("Test database marker mismatch");
	}
	async function stop() {
		if (stopped) return;
		stopped = true;
		writeFileSync(join(directory, "worker.log"), output);
		if (child?.pid && child.exitCode === null && child.signalCode === null) {
			const exited = new Promise<void>((done) => child?.once("exit", () => done()));
			process.kill(-child.pid, "SIGTERM");
			await exited;
		}
		if (!initialized) return;
		assertMarker();
		if (readFileSync(config, "utf8").includes('"name":"bogo-test"')) {
			rmSync(directory, { recursive: true });
		}
	}
	return {
		directory,
		config,
		persist,
		env,
		async start(port: number) {
			try {
				command(["d1", "migrations", "apply", "bogo"]);
				command([
					"d1",
					"execute",
					"bogo",
					"--command",
					"CREATE TABLE _test_marker (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO _test_marker VALUES ('env','test')",
				]);
				assertMarker();
				initialized = true;
				child = spawn(wrangler, ["dev", "--port", String(port), ...args], {
					cwd: directory,
					env,
					detached: true,
					stdio: ["ignore", "pipe", "pipe"],
				});
				for (const stream of [child.stdout, child.stderr]) {
					stream?.on("data", (data) => {
						output = `${output}${String(data)}`.slice(-20_000);
					});
				}
				child.on("error", (error) => {
					output += String(error);
				});
				await waitForHealthyWorker(`http://127.0.0.1:${port}`, child, () => output);
			} catch (error) {
				await stop();
				throw error;
			}
		},
		execute(sql: string) {
			assertMarker();
			return command(["d1", "execute", "bogo", "--command", sql]);
		},
		stop,
	};
}

if (import.meta.main) {
	const fixture = createTestWorker();
	for (const signal of ["SIGTERM", "SIGINT"] as const) {
		process.once(signal, async () => {
			await fixture.stop();
			process.exit();
		});
	}
	await fixture.start(Number(process.argv[2]));
}
