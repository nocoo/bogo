#!/usr/bin/env bun
/**
 * Build @nocoo/bogo from the canonical clip.yaml.
 *
 * Steps:
 *   1. Resolve a clip runner (PATH or sibling ../clip checkout — same
 *      logic as scripts/check-clip-yaml.ts).
 *   2. clip generate <repo-root>/clip.yaml --output build/raw
 *      (Throwaway scratch dir; never published.)
 *   3. Verify the generated package.json version matches our own —
 *      "one version everywhere" guarantee.
 *   4. bun build the generated entry into a single dist/index.js with
 *      @nocoo/cli-base + commander bundled in, shebang rewritten to
 *      `node` so npm users without bun can run it.
 *   5. chmod +x dist/index.js, so npm's bin symlink works on Unix.
 *
 * The build is hermetic per repo state: same clip.yaml + same clip
 * version → same dist. publish runs this via `prepack`.
 */

import { execSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const CLIP_YAML = resolve(REPO_ROOT, "clip.yaml");
const BUILD_DIR = resolve(PKG_ROOT, "build");
const RAW_DIR = resolve(BUILD_DIR, "raw");
const DIST_DIR = resolve(PKG_ROOT, "dist");
const DIST_ENTRY = resolve(DIST_DIR, "index.js");

const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf-8")) as {
	name: string;
	version: string;
};

function step(msg: string): void {
	process.stdout.write(`\n→ ${msg}\n`);
}

function resolveClipRunner(): { cmd: string; args: string[] } {
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
	throw new Error(
		"`clip` is not on PATH and there is no ../clip checkout. Install clip first: https://github.com/nocoo/clip",
	);
}

// 1 + 2. clip generate → build/raw
step(`Building ${pkg.name}@${pkg.version}`);

if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true, force: true });
if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const runner = resolveClipRunner();
step(`clip generate (${runner.cmd} ${runner.args.join(" ")})`);
execSync(
	`${runner.cmd} ${runner.args.join(" ")} generate ${CLIP_YAML} --output ${RAW_DIR}`,
	{ stdio: "inherit" },
);

// 3. Version invariant
step("Verifying clip.yaml version === @nocoo/bogo version");
const rawPkg = JSON.parse(readFileSync(resolve(RAW_DIR, "package.json"), "utf-8")) as {
	version: string;
};
if (rawPkg.version !== pkg.version) {
	throw new Error(
		`Version drift: clip.yaml produced ${rawPkg.version} but packages/cli/package.json is ${pkg.version}. ` +
			`Run 'bun scripts/bump-version.ts patch|minor|major' from the repo root to bring them back in sync.`,
	);
}

// 4. Install raw deps and bundle to dist/index.js. Deps are bundled in
// so the npm tarball is a single file and `npm i -g @nocoo/bogo` works
// on plain node without a local bun install of @nocoo/cli-base/commander.
step("bun install (raw deps)");
execSync("bun install --no-save", { stdio: "inherit", cwd: RAW_DIR });

step("bundling dist/index.js");
mkdirSync(DIST_DIR, { recursive: true });
execSync(
	`bun build ${resolve(RAW_DIR, "src/index.ts")} --target=node --outfile=${DIST_ENTRY}`,
	{ stdio: "inherit", cwd: RAW_DIR },
);

// Rewrite shebang from `bun` to `node` so it runs without a bun install.
const built = readFileSync(DIST_ENTRY, "utf-8").replace(/^#!\s*\S+\s*\S*/, "#!/usr/bin/env node");
writeFileSync(DIST_ENTRY, built);

// 5. npm needs the bin entry to be executable for the symlink to work.
chmodSync(DIST_ENTRY, 0o755);

step(`✔ Built ${DIST_ENTRY}`);
console.log(
	`  source: clip.yaml @ ${rawPkg.version}\n  size: ${(readFileSync(DIST_ENTRY).byteLength / 1024).toFixed(1)} KiB`,
);
