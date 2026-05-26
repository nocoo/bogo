import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const PACKAGE_JSONS = [
	resolve(ROOT, "package.json"),
	resolve(ROOT, "packages/shared/package.json"),
	resolve(ROOT, "packages/worker/package.json"),
	resolve(ROOT, "packages/ui/package.json"),
];

const SHARED_INDEX = resolve(ROOT, "packages/shared/src/index.ts");

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
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	pkg.version = newVersion;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
}

const sharedSrc = readFileSync(SHARED_INDEX, "utf-8");
const updated = sharedSrc.replace(
	/export const BOGO_VERSION = "[^"]+";/,
	`export const BOGO_VERSION = "${newVersion}";`,
);
writeFileSync(SHARED_INDEX, updated);

console.log(`Bumped: ${rootPkg.version} → ${newVersion}`);
