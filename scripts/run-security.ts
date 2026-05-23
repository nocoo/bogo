#!/usr/bin/env bun
/**
 * Security gate — runs osv-scanner + gitleaks.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

function run(cmd: string, args: string[]): number {
	const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
	return result.status ?? 1;
}

let failed = false;

console.log("━━━ osv-scanner ━━━");
const osvExit = run("osv-scanner", [
	"scan",
	"--lockfile",
	"bun.lock",
	"--config",
	"osv-scanner.toml",
]);
if (osvExit !== 0) {
	console.error("❌ osv-scanner failed");
	failed = true;
}

console.log("━━━ gitleaks ━━━");
const glExit = run("gitleaks", ["detect", "--no-banner", "-v"]);
if (glExit !== 0) {
	console.error("❌ gitleaks failed");
	failed = true;
}

if (failed) {
	process.exit(1);
}
console.log("✔ Security gate passed");
