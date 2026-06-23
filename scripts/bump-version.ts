import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const PACKAGE_JSONS = [
	resolve(ROOT, "package.json"),
	resolve(ROOT, "packages/shared/package.json"),
	resolve(ROOT, "packages/worker/package.json"),
	resolve(ROOT, "packages/ui/package.json"),
	resolve(ROOT, "packages/cli/package.json"),
];

const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");
const CLIP_YAML = resolve(ROOT, "clip.yaml");

const bump = process.argv[2] as "patch" | "minor" | "major" | undefined;
if (!bump || !["patch", "minor", "major"].includes(bump)) {
	console.error("Usage: bun scripts/bump-version.ts <patch|minor|major>");
	process.exit(1);
}

const rootPkg = JSON.parse(readFileSync(PACKAGE_JSONS[0], "utf-8"));
const [major, minor, patch] = rootPkg.version.split(".").map(Number);

let newVersion: string;
if (bump === "major") newVersion = `${major + 1}.0.0`;
else if (bump === "minor") newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

for (const pkgPath of PACKAGE_JSONS) {
	if (!existsSync(pkgPath)) {
		// packages/cli is brand new; skip silently if absent on older branches
		continue;
	}
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	pkg.version = newVersion;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
}

const sharedSrc = readFileSync(SHARED_INDEX, "utf-8");
const updatedShared = sharedSrc.replace(
	/export const BOGO_VERSION = "[^"]+";/,
	`export const BOGO_VERSION = "${newVersion}";`,
);
writeFileSync(SHARED_INDEX, updatedShared);

// clip.yaml carries the version that ends up in the generated CLI's
// `bogo --version` output and the @nocoo/bogo package.json clip writes.
// Keep it in lockstep so `bogo --version` is never stale.
const yaml = readFileSync(CLIP_YAML, "utf-8");
const updatedYaml = yaml.replace(/^version:\s*"[^"]+"/m, `version: "${newVersion}"`);
if (updatedYaml === yaml) {
	console.error(`Failed to bump version in ${CLIP_YAML} — pattern did not match`);
	process.exit(1);
}
writeFileSync(CLIP_YAML, updatedYaml);

console.log(`Bumped: ${rootPkg.version} → ${newVersion}`);
console.log(
	`  package.json × ${PACKAGE_JSONS.filter((p) => existsSync(p)).length}, shared/src/index.ts, clip.yaml`,
);
