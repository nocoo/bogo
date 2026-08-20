import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = join(ROOT, "packages/worker");
const SEED = join(WORKER, "seeds/northwind-labs.sql");
const D1_DIR = join(WORKER, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const wranglerBin = createRequire(join(WORKER, "package.json")).resolve("wrangler");

function wrangler(args: string[]): void {
	const result = spawnSync(process.execPath, [wranglerBin, ...args], {
		cwd: WORKER,
		stdio: "inherit",
		env: { ...process.env, CI: "true" },
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function localD1Path(): string {
	if (!existsSync(D1_DIR)) {
		console.error(`local D1 directory missing: ${D1_DIR}`);
		process.exit(1);
	}
	const files = readdirSync(D1_DIR).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
	if (files.length !== 1) {
		console.error(`expected one local D1 sqlite in ${D1_DIR}, found ${files.length}`);
		process.exit(1);
	}
	return join(D1_DIR, files[0]);
}

if (!existsSync(SEED)) {
	console.error(`seed file missing: ${SEED}`);
	process.exit(1);
}

if (process.argv.includes("--remote")) {
	console.error("seed:local is local D1 only. Refusing --remote.");
	process.exit(1);
}

console.log("Applying local D1 migrations…");
wrangler(["d1", "migrations", "apply", "bogo", "--local"]);

const dbPath = localD1Path();
console.log(`Loading Northwind Labs seed into ${dbPath}…`);

const sql = await Bun.file(SEED).text();
const db = new Database(dbPath);
try {
	db.exec("PRAGMA foreign_keys = OFF");
	db.exec(sql);
} catch (err) {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`seed failed: ${message}`);
	console.error("Stop `bun dev` if wrangler has the local D1 file locked, then retry.");
	process.exit(1);
} finally {
	db.close();
}

console.log("Local seed ready: workspace Northwind Labs (10 people).");
console.log("Start the app with: bun dev");
