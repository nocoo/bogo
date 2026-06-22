import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ChildProcess, execSync, spawn, spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Smoke E2E for the clip-generated bogo CLI (docs/features/02-cli.md
// Commit 7). The spec calls out four pitfalls that, if missed, make
// the test "pass but be meaningless"; each is encoded below:
//
//   1. `_login.ts` hard-codes apiUrl/loginPath/tokenParam at generate
//      time. CLIP_BASE_URL only affects business calls, not login. So
//      we generate a TEMPORARY clip.yaml with baseUrl rewritten to
//      http://127.0.0.1:<PORT> before running `clip generate`.
//   2. cli-base's openBrowser uses `exec("open <url>")` (or xdg-open),
//      so we shadow PATH with a fake-bin that contains failing `open`
//      / `xdg-open`. The failure makes performLogin log the URL to
//      stdout; the test parses it and completes the loopback via fetch.
//   3. D1 revoke must use the SAME --persist-to dir the wrangler dev
//      server reads from. We use a per-test PERSIST under TMP.
//   4. Generated commands print the full response wrapped in `{data:…}`.
//      All assertions go through JSON.parse(stdout).data.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const WORKER_ROOT = join(REPO_ROOT, "packages", "worker");
const CLIP_YAML = join(REPO_ROOT, "clip.yaml");
const PORT = 27036;
const BASE = `http://127.0.0.1:${PORT}`;

function hasOnPath(cmd: string): boolean {
	try {
		execSync(`command -v ${cmd}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

function resolveClipRunner(): { cmd: string; args: string[] } | null {
	if (hasOnPath("clip")) return { cmd: "clip", args: [] };
	const localClip = resolve(REPO_ROOT, "..", "clip", "packages", "cli", "src", "index.ts");
	try {
		readFileSync(localClip);
		return { cmd: "bun", args: [localClip] };
	} catch {
		return null;
	}
}

const clipRunner = resolveClipRunner();

// CI must hard-fail when clip is missing — silent skip would defeat
// BOGO_REQUIRE_CLI_E2E=1 (see docs/features/02-cli.md §995-1001).
if (!clipRunner && process.env.BOGO_REQUIRE_CLI_E2E) {
	throw new Error(
		"BOGO_REQUIRE_CLI_E2E=1 but `clip` is not on PATH and no fallback at ../clip/packages/cli/src/index.ts — install clip or unset the flag.",
	);
}

const maybeDescribe = clipRunner ? describe : describe.skip;

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok || res.status === 401 || res.status === 503) return;
		} catch {
			/* not yet */
		}
		await sleep(300);
	}
	throw new Error(`Wrangler did not start within ${timeoutMs}ms at ${url}`);
}

async function readLineMatching(
	stream: NodeJS.ReadableStream,
	pattern: RegExp,
	timeoutMs = 15_000,
): Promise<string> {
	let buffer = "";
	return new Promise<string>((resolveP, rejectP) => {
		const onData = (chunk: Buffer | string) => {
			buffer += chunk.toString();
			for (const line of buffer.split(/\r?\n/)) {
				const m = line.match(pattern);
				if (m) {
					stream.off("data", onData);
					resolveP(m[0]);
					return;
				}
			}
		};
		stream.on("data", onData);
		setTimeout(() => {
			stream.off("data", onData);
			rejectP(
				new Error(
					`Timed out waiting for /${pattern.source}/ after ${timeoutMs}ms. Captured stdout:\n${buffer}`,
				),
			);
		}, timeoutMs);
	});
}

function waitForExit(proc: ChildProcess, timeoutMs = 15_000): Promise<number | null> {
	return new Promise<number | null>((resolveP, rejectP) => {
		const t = setTimeout(() => rejectP(new Error("CLI did not exit in time")), timeoutMs);
		proc.on("exit", (code) => {
			clearTimeout(t);
			resolveP(code);
		});
	});
}

maybeDescribe("bogo CLI e2e (login + CRUD + revoke)", () => {
	if (!clipRunner) return; // type narrowing — describe.skip already declined

	let tmpDir: string;
	let clipHome: string;
	let persist: string;
	let fakeBin: string;
	let cliDir: string;
	let wrangler: ChildProcess | null = null;
	let subEnv: NodeJS.ProcessEnv;

	beforeAll(async () => {
		tmpDir = mkdtempSync(join(tmpdir(), "bogo-cli-e2e-"));
		clipHome = join(tmpDir, "clip-home");
		persist = join(tmpDir, "wrangler");
		fakeBin = join(tmpDir, "fake-bin");
		cliDir = join(tmpDir, "bogo-cli");

		mkdirSync(clipHome, { recursive: true });
		mkdirSync(fakeBin, { recursive: true });

		// Fake `open` / `xdg-open` so cli-base's openBrowser fails and the
		// fallback log emits the login URL to stdout.
		const fakeScript = "#!/usr/bin/env bash\nexit 1\n";
		for (const name of ["open", "xdg-open"]) {
			const p = join(fakeBin, name);
			writeFileSync(p, fakeScript);
			chmodSync(p, 0o755);
		}

		subEnv = {
			...process.env,
			CLIP_HOME: clipHome,
			PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
		};

		// Apply migrations into the isolated persist dir, then spawn wrangler
		// dev against the same persist dir so the revoke UPDATE in test 3
		// actually lands on the DB the worker reads.
		execSync(`npx wrangler d1 migrations apply bogo --local --persist-to ${persist}`, {
			cwd: WORKER_ROOT,
			stdio: "ignore",
		});

		wrangler = spawn(
			"npx",
			["wrangler", "dev", "--port", String(PORT), "--local", "--persist-to", persist],
			{
				cwd: WORKER_ROOT,
				stdio: "ignore",
				env: {
					...process.env,
					CF_ACCESS_TEAM_DOMAIN: "e2e-cli.cloudflareaccess.com",
					CF_ACCESS_AUD: "e2e-cli-aud",
				},
			},
		);

		await waitForServer(`${BASE}/api/live`);

		// Generate a CLI from a temporary schema with baseUrl pointed at our
		// wrangler dev port. clip's generator hard-codes the api/login URL
		// into the generated CLI at codegen time; CLIP_BASE_URL only
		// overrides business request URLs, not login.
		const yaml = readFileSync(CLIP_YAML, "utf-8").replace(/baseUrl:.*$/m, `baseUrl: "${BASE}"`);
		const tmpYaml = join(tmpDir, "clip.yaml");
		writeFileSync(tmpYaml, yaml);

		const generateCmd = [
			clipRunner.cmd,
			...clipRunner.args,
			"generate",
			tmpYaml,
			"--output",
			cliDir,
		].join(" ");
		execSync(generateCmd, { stdio: "ignore" });

		execSync("bun install", { cwd: cliDir, stdio: "ignore" });
	}, 120_000);

	afterAll(() => {
		if (wrangler) {
			wrangler.kill();
			wrangler = null;
		}
		if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
	});

	function runCli(args: string[]): unknown {
		const r = spawnSync("bun", ["src/index.ts", ...args], {
			cwd: cliDir,
			env: subEnv,
			encoding: "utf-8",
		});
		if (r.status !== 0) {
			throw new Error(
				`bogo ${args.join(" ")} failed (status=${r.status}):\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
			);
		}
		const parsed = JSON.parse(r.stdout) as { data: unknown };
		return parsed.data;
	}

	test("login → credentials.json", async () => {
		const cli = spawn("bun", ["src/index.ts", "login"], {
			cwd: cliDir,
			env: subEnv,
			stdio: ["ignore", "pipe", "pipe"],
		});

		const loginUrl = await readLineMatching(
			cli.stdout as NodeJS.ReadableStream,
			/https?:\/\/127\.0\.0\.1:\d+\/api\/auth\/cli\?\S+/,
		);

		// Complete the loopback by following the 302 the worker returns.
		// performLogin's loopback server captures the token from the redirect.
		await fetch(loginUrl, { redirect: "follow" });

		const exitCode = await waitForExit(cli, 20_000);
		expect(exitCode).toBe(0);

		const credPath = join(clipHome, "bogo", "credentials.json");
		const creds = JSON.parse(readFileSync(credPath, "utf-8")) as {
			type: string;
			token: string;
			email?: string;
		};
		expect(creds.type).toBe("browser-login");
		expect(creds.token).toMatch(/^bogo_/);
		expect(creds.email).toBe("dev@localhost");

		// 0o600 (owner rw only) — credential hygiene
		expect(statSync(credPath).mode & 0o777).toBe(0o600);
	}, 60_000);

	test("CRUD chain via generated commands", () => {
		const me = runCli(["me"]) as { email: string };
		expect(me.email).toBe("dev@localhost");

		const listBefore = runCli(["workspaces-list"]) as unknown[];
		expect(Array.isArray(listBefore)).toBe(true);

		const ws = runCli(["workspaces-create", "--name", "CLI E2E"]) as { id: string };
		expect(ws.id).toMatch(/[0-9a-f-]{36}/);

		const persons = runCli(["persons-list", ws.id]) as Array<{
			id: string;
			isRoot?: boolean;
		}>;
		const root = persons.find((p) => p.isRoot);
		expect(root).toBeTruthy();
		if (!root) throw new Error("expected a root person but found none");
		const rootId = root.id;

		const eng = runCli(["persons-create", ws.id, "--name", "Eng", "--managerId", rootId]) as {
			name: string;
		};
		expect(eng.name).toBe("Eng");

		const doc = runCli(["documents-create", ws.id, "--title", "Doc", "--personIds", rootId]) as {
			id: string;
		};
		expect(doc.id).toMatch(/[0-9a-f-]{36}/);

		const versions = runCli(["documents-versions", ws.id, doc.id]) as Array<{
			version: number;
		}>;
		expect(versions[0]?.version).toBe(1);

		// Tear down children before the workspace; the worker's workspaces
		// DELETE refuses (HTTP 500 from FK) if persons/documents remain.
		runCli(["documents-delete", ws.id, doc.id]);
		runCli(["persons-delete", ws.id, eng.id]);
		runCli(["workspaces-delete", ws.id]);
	}, 60_000);

	test("revoke → /api/me returns 401 with the same token", () => {
		const creds = JSON.parse(readFileSync(join(clipHome, "bogo", "credentials.json"), "utf-8")) as {
			token: string;
		};
		// prefix charset is restricted (bogo_ + base64url) so this
		// shell-interpolated UPDATE cannot be injected.
		const prefix = creds.token.slice(0, 12);

		execSync(
			`npx wrangler d1 execute bogo --local --persist-to ${persist} ` +
				`--command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='${prefix}'"`,
			{ cwd: WORKER_ROOT, stdio: "ignore" },
		);

		const r = spawnSync("bun", ["src/index.ts", "me"], {
			cwd: cliDir,
			env: subEnv,
			encoding: "utf-8",
		});
		expect(r.status).not.toBe(0);
		expect(r.stderr + r.stdout).toMatch(/401/);
	}, 30_000);
});
