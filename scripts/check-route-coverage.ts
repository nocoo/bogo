#!/usr/bin/env bun
/**
 * L2 route coverage gate.
 *
 * Statically extract every `(method, path)` declared in packages/worker/src,
 * including routes mounted via `app.route(prefix, module)`, then check that
 * every route is exercised by at least one E2E test request.
 *
 * Run: `bun run scripts/check-route-coverage.ts`
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const WORKER_SRC = join(ROOT, "packages/worker/src");
const WORKER_INDEX = join(WORKER_SRC, "index.ts");
const E2E_DIR = join(ROOT, "packages/worker/test/e2e");

type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
type Route = { method: RouteMethod; path: string };

function discoverDeclaredRoutes(): Route[] {
	const src = readFileSync(WORKER_INDEX, "utf-8");
	const routes: Route[] = [];

	const directRe = /\bapp\.(get|post|put|delete|patch|head)\(\s*["']([^"']+)["']/g;
	for (const m of src.matchAll(directRe)) {
		const method = m[1];
		const path = m[2];
		if (method && path && path.startsWith("/api/")) {
			routes.push({ method: method.toUpperCase() as RouteMethod, path });
		}
	}

	const mountRe = /\bapp\.route\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g;
	const importRe = /import\s*\{[^}]*\b(\w+)\b[^}]*\}\s*from\s*["']([^"']+)["']/g;
	const imports = new Map<string, string>();
	for (const im of src.matchAll(importRe)) {
		if (im[1] && im[2]) {
			imports.set(im[1], im[2]);
		}
	}

	for (const m of src.matchAll(mountRe)) {
		const prefix = m[1];
		const varName = m[2];
		if (!(prefix && varName)) continue;

		const importPath = imports.get(varName);
		if (!importPath) continue;

		const filePath = resolveImport(importPath);
		if (!filePath) continue;

		const subRoutes = extractSubRoutes(filePath);
		for (const sub of subRoutes) {
			routes.push({ method: sub.method, path: prefix + sub.path });
		}
	}

	return routes;
}

function resolveImport(importPath: string): string | null {
	let resolved = importPath.replace(/\.js$/, ".ts");
	if (!resolved.startsWith(".")) return null;
	const full = join(WORKER_SRC, resolved);
	try {
		readFileSync(full);
		return full;
	} catch {
		return null;
	}
}

function extractSubRoutes(filePath: string): Route[] {
	const src = readFileSync(filePath, "utf-8");
	const routes: Route[] = [];

	const re = /\b\w+\.(get|post|put|delete|patch|head)\(\s*["']([^"']+)["']/g;
	for (const m of src.matchAll(re)) {
		const method = m[1];
		const path = m[2];
		if (method && path) {
			routes.push({ method: method.toUpperCase() as RouteMethod, path });
		}
	}
	return routes;
}

function discoverE2ERequests(): Route[] {
	let files: string[];
	try {
		files = readdirSync(E2E_DIR).filter((f) => f.endsWith(".test.ts"));
	} catch {
		return [];
	}

	const requests: Route[] = [];

	for (const file of files) {
		const src = readFileSync(join(E2E_DIR, file), "utf-8");

		const fetchRe =
			/fetch\(\s*[`"'][^`"']*?(\/api\/[^`"'?]+)[^`"']*?[`"']\s*(?:,\s*\{([^}]*)\})?/gs;
		for (const m of src.matchAll(fetchRe)) {
			const rawPath = m[1];
			const opts = m[2] ?? "";
			if (!rawPath) continue;

			const methodMatch = opts.match(/method:\s*["'`](\w+)["'`]/);
			const method = (methodMatch ? methodMatch[1].toUpperCase() : "GET") as RouteMethod;
			requests.push({ method, path: normaliseRequestPath(rawPath) });
		}

		const helperRe = /\b(get|post|put|delete|patch|head)\(\s*[`"']([^`"']+)[`"']/g;
		for (const m of src.matchAll(helperRe)) {
			const helper = m[1];
			const rawPath = m[2];
			if (!(helper && rawPath)) continue;
			if (!rawPath.startsWith("/api/")) continue;
			const method = helper.toUpperCase() as RouteMethod;
			requests.push({ method, path: normaliseRequestPath(rawPath) });
		}

		const templateRe = /fetch\(\s*`\$\{BASE\}(\/api\/[^`?]+)`\s*(?:,\s*\{([^}]*)\})?/gs;
		for (const m of src.matchAll(templateRe)) {
			const rawPath = m[1];
			const opts = m[2] ?? "";
			if (!rawPath) continue;
			const methodMatch = opts.match(/method:\s*["'`](\w+)["'`]/);
			const method = (methodMatch ? methodMatch[1].toUpperCase() : "GET") as RouteMethod;
			requests.push({ method, path: normaliseRequestPath(rawPath) });
		}

		const apiHelperRe = /\bapi\(\s*[`"'](\/api\/[^`"'?]+)[`"']\s*(?:,\s*\{([^}]*)\})?/gs;
		for (const m of src.matchAll(apiHelperRe)) {
			const rawPath = m[1];
			const opts = m[2] ?? "";
			if (!rawPath) continue;
			const methodMatch = opts.match(/method:\s*["'`](\w+)["'`]/);
			const method = (methodMatch ? methodMatch[1].toUpperCase() : "GET") as RouteMethod;
			requests.push({ method, path: normaliseRequestPath(rawPath) });
		}

		const apiTemplateLitRe = /\bapi\(\s*`(\/api\/[^`?]+)`\s*(?:,\s*\{([^}]*)\})?/gs;
		for (const m of src.matchAll(apiTemplateLitRe)) {
			const rawPath = m[1];
			const opts = m[2] ?? "";
			if (!rawPath) continue;
			const methodMatch = opts.match(/method:\s*["'`](\w+)["'`]/);
			const method = (methodMatch ? methodMatch[1].toUpperCase() : "GET") as RouteMethod;
			requests.push({ method, path: normaliseRequestPath(rawPath) });
		}
	}
	return requests;
}

function routeToRegex(path: string): RegExp {
	const escaped = path
		.split("/")
		.map((seg) => {
			if (seg.startsWith(":")) return "[^/]+";
			return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		})
		.join("/");
	return new RegExp(`^${escaped}$`);
}

function normaliseRequestPath(path: string): string {
	return path.replace(/\$\{[^}]+\}/g, "x");
}

function isMatch(route: Route, request: Route): boolean {
	const methodOk =
		route.method === request.method || (route.method === "GET" && request.method === "HEAD");
	if (!methodOk) return false;
	const routePath = route.path.replace(/\/$/, "") || "/";
	const requestPath = request.path.replace(/\/$/, "") || "/";
	return routeToRegex(routePath).test(requestPath);
}

function main(): void {
	console.info("=== L2 Route Coverage Gate ===\n");

	const declared = discoverDeclaredRoutes();
	const requests = discoverE2ERequests();

	console.info(`Declared routes: ${declared.length}`);
	console.info(`E2E requests:    ${requests.length}\n`);

	if (declared.length === 0) {
		console.info("✔ No routes declared — pass.\n");
		return;
	}

	const uncovered: Route[] = [];
	for (const route of declared) {
		const hit = requests.some((req) => isMatch(route, req));
		if (!hit) uncovered.push(route);
	}

	if (uncovered.length === 0) {
		console.info(`✔ All ${declared.length} routes have at least one E2E request.\n`);
		return;
	}

	console.error(`❌ ${uncovered.length} route(s) have NO E2E coverage:\n`);
	for (const r of uncovered) {
		console.error(`  ${r.method.padEnd(6)} ${r.path}`);
	}
	console.error("\nAdd a request in packages/worker/test/e2e/ for each uncovered route.\n");
	process.exit(1);
}

main();
