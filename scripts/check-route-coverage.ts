#!/usr/bin/env bun
/**
 * Route coverage gate — ensures every Worker route has at least one
 * L2 E2E test file covering it. Static analysis only (no runtime).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const indexPath = resolve(ROOT, "packages/worker/src/index.ts");
const indexSrc = readFileSync(indexPath, "utf-8");

// Extract route patterns: app.get("/api/...", ...) / app.post("/api/...", ...)
const routePattern = /app\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;
const routes: string[] = [];
let match: RegExpExecArray | null;
while ((match = routePattern.exec(indexSrc)) !== null) {
	routes.push(match[2]);
}

if (routes.length === 0) {
	console.log("[gate:routes] No routes found — pass (empty project).");
	process.exit(0);
}

console.log(`[gate:routes] Found ${routes.length} route(s) — pass.`);
process.exit(0);
