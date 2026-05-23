import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { backupDevVars, restoreDevVars } from "./helpers/dev-vars";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = join(__dirname, "../..");
const PERSIST_DIR = join(WORKER_ROOT, ".wrangler/e2e");
const DEV_VARS_PATH = join(WORKER_ROOT, ".dev.vars");

const PORT = 17035;
const BASE = `http://localhost:${PORT}`;

const E2E_DEV_VARS =
	"CF_ACCESS_TEAM_DOMAIN=e2e-test.cloudflareaccess.com\nCF_ACCESS_AUD=e2e-test-aud\n";

let wranglerProc: ChildProcess | null = null;
let devVarsBackup: { existed: boolean; content: string | null } = { existed: false, content: null };

function assertNoRemoteCloudflareEnv(): void {
	const offenders = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CF_API_TOKEN"].filter(
		(k) => process.env[k],
	);
	if (offenders.length > 0) {
		throw new Error(`E2E isolation guard: refusing to start with ${offenders.join(", ")} set.`);
	}
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok || res.status === 401 || res.status === 503) {
				return;
			}
		} catch {
			// not ready
		}
		await sleep(300);
	}
	throw new Error(`Wrangler did not start within ${timeoutMs}ms`);
}

export async function setup(): Promise<void> {
	assertNoRemoteCloudflareEnv();

	devVarsBackup = backupDevVars(DEV_VARS_PATH);
	writeFileSync(DEV_VARS_PATH, E2E_DEV_VARS);

	if (existsSync(PERSIST_DIR)) {
		rmSync(PERSIST_DIR, { recursive: true, force: true });
	}

	wranglerProc = spawn(
		"npx",
		["wrangler", "dev", "--port", String(PORT), "--local", "--persist-to", ".wrangler/e2e"],
		{ cwd: WORKER_ROOT, stdio: "ignore" },
	);

	await waitForServer(`${BASE}/api/live`);

	process.env.BOGO_E2E_BASE = BASE;
}

export async function teardown(): Promise<void> {
	if (wranglerProc) {
		wranglerProc.kill();
		wranglerProc = null;
	}
	restoreDevVars(DEV_VARS_PATH, devVarsBackup);
	if (existsSync(PERSIST_DIR)) {
		rmSync(PERSIST_DIR, { recursive: true, force: true });
	}
}
