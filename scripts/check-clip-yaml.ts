#!/usr/bin/env bun
/**
 * Validate that the repo-root `clip.yaml` still produces a working CLI when
 * fed to `clip generate`. See docs/features/02-cli.md §857-866 (Commit 6).
 *
 * Strategy:
 *   1. Resolve a clip runner — prefer `clip` on PATH; otherwise fall back to
 *      `../clip/packages/cli/src/index.ts` next to the bogo checkout so the
 *      check still runs in the typical local dev layout.
 *   2. `clip generate <repo>/clip.yaml --output <tmp>`; zero exit + a sane
 *      file tree (src/index.ts, src/commands/_login.ts, package.json) means
 *      the yaml is intact.
 *   3. Cross-check command coverage by counting the generated command files
 *      and matching the §3 command matrix size (43 endpoints + `_login.ts`).
 *
 * Env knobs (kept aligned with the spec's CLI-e2e gate for predictability):
 *   - `BOGO_REQUIRE_CLI_E2E=1`  — hard-fail when `clip` cannot be resolved
 *     (CI must export this).
 *   - `BOGO_SKIP_CLI_E2E=1`     — skip silently (local dev escape hatch).
 *   - Without either, fall back to a soft skip with a warning so the check
 *     does not block contributors who have not installed `clip` locally.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const CLIP_YAML = join(REPO_ROOT, "clip.yaml");

if (!existsSync(CLIP_YAML)) {
	console.error(`❌ clip.yaml missing at ${CLIP_YAML}`);
	process.exit(1);
}

if (process.env.BOGO_SKIP_CLI_E2E && !process.env.BOGO_REQUIRE_CLI_E2E) {
	console.log("[check-clip-yaml] BOGO_SKIP_CLI_E2E set — skipping");
	process.exit(0);
}

type Runner = { cmd: string; args: string[] };

function resolveClipRunner(): Runner | null {
	try {
		execSync("command -v clip", { stdio: "ignore" });
		return { cmd: "clip", args: [] };
	} catch {
		// fall through
	}
	const localClip = resolve(REPO_ROOT, "..", "clip", "packages", "cli", "src", "index.ts");
	if (existsSync(localClip)) {
		return { cmd: "bun", args: [localClip] };
	}
	return null;
}

const runner = resolveClipRunner();
if (!runner) {
	const message =
		"`clip` is not on PATH and the local fallback `../clip/packages/cli/src/index.ts` does not exist.";
	if (process.env.BOGO_REQUIRE_CLI_E2E) {
		console.error(`❌ ${message}`);
		console.error("   BOGO_REQUIRE_CLI_E2E=1 — install clip or remove the env to bypass.");
		process.exit(1);
	}
	console.warn(`⚠️  ${message}`);
	console.warn(
		"   Skipping clip.yaml validation; set BOGO_REQUIRE_CLI_E2E=1 in CI to make this fatal.",
	);
	process.exit(0);
}

const out = mkdtempSync(join(tmpdir(), "bogo-clip-validate-"));
try {
	execSync(`${runner.cmd} ${runner.args.join(" ")} generate ${CLIP_YAML} --output ${out}`, {
		stdio: "inherit",
	});

	const required = ["package.json", "src/index.ts", "src/commands/_login.ts"];
	const missing = required.filter((p) => !existsSync(join(out, p)));
	if (missing.length > 0) {
		console.error(`❌ Generated CLI is missing expected files: ${missing.join(", ")}`);
		process.exit(1);
	}

	// The yaml currently declares 48 endpoints (live, me, workspaces x5,
	// persons x7, documents x10 incl. /versions/:version single-version
	// read, fields x6, doc-types x4, tags x9, table-views x5). clip's
	// browser-login codegen also emits `_login.ts`, so the expected file
	// count is exactly 49.
	// Tightened from a loose < 40 so a regression that drops a couple of
	// endpoints is not silently accepted.
	const EXPECTED_COMMAND_FILES = 49;
	const cmdFiles = readdirSync(join(out, "src", "commands")).filter((f) => f.endsWith(".ts"));
	if (cmdFiles.length !== EXPECTED_COMMAND_FILES) {
		console.error(
			`❌ Generated CLI has ${cmdFiles.length} command files; expected ${EXPECTED_COMMAND_FILES}. The yaml may have lost or gained endpoints — update EXPECTED_COMMAND_FILES if the change is intentional.`,
		);
		process.exit(1);
	}

	console.log(
		`✔ clip.yaml validates — generated ${cmdFiles.length} command file(s) at ${out} via ${runner.cmd} ${runner.args.join(" ")}`,
	);
} finally {
	rmSync(out, { recursive: true, force: true });
}
