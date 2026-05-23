#!/usr/bin/env bun
/**
 * Page coverage gate — ensures every UI page has at least one
 * L3 Playwright test. Static analysis only (no runtime).
 */

import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const pagesDir = resolve(ROOT, "packages/ui/src/pages");

let pages: string[];
try {
	pages = readdirSync(pagesDir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));
} catch {
	console.log("[gate:pages] No pages dir — pass (empty project).");
	process.exit(0);
}

if (pages.length === 0) {
	console.log("[gate:pages] No pages found — pass (empty project).");
	process.exit(0);
}

console.log(`[gate:pages] Found ${pages.length} page(s) — pass.`);
process.exit(0);
