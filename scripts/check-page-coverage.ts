#!/usr/bin/env bun
/**
 * L3 page coverage gate.
 *
 * Statically extract every page component from packages/ui/src/pages/ and every
 * page.goto(...) from packages/ui/tests/*.spec.ts. Fail if any declared page
 * is not visited by at least one Playwright spec.
 *
 * For projects with React Router: scans <Route path="..."> in App.tsx.
 * For projects without routing: scans pages directory and requires at least
 * one page.goto("/") in specs per page file.
 *
 * Run: `bun run scripts/check-page-coverage.ts`
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const APP_TSX = join(ROOT, "packages/ui/src/App.tsx");
const PAGES_DIR = join(ROOT, "packages/ui/src/pages");
const TESTS_DIR = join(ROOT, "packages/ui/tests");

type Page = { path: string; source: string };

function discoverClientRoutes(): Page[] {
	const src = readFileSync(APP_TSX, "utf-8");
	const pages: Page[] = [];

	const routeRe = /<Route\s+[^>]*path=["']([^"']+)["']/g;
	for (const m of src.matchAll(routeRe)) {
		const path = m[1];
		if (path) {
			pages.push({ path, source: "Route" });
		}
	}

	if (pages.length > 0) {
		return pages;
	}

	let pageFiles: string[];
	try {
		pageFiles = readdirSync(PAGES_DIR).filter(
			(f) => f.endsWith(".tsx") && !f.includes(".test."),
		);
	} catch {
		return [];
	}

	for (const file of pageFiles) {
		pages.push({ path: "/", source: file });
	}
	return pages;
}

function discoverPlaywrightTargets(): string[] {
	if (!existsSync(TESTS_DIR)) return [];

	const files = readdirSync(TESTS_DIR).filter((f) => f.endsWith(".spec.ts"));
	const targets: string[] = [];

	for (const file of files) {
		const src = readFileSync(join(TESTS_DIR, file), "utf-8");

		const gotoRe = /page\.goto\(\s*["'`]([^"'`]+)["'`]/g;
		for (const m of src.matchAll(gotoRe)) {
			const path = m[1];
			if (path) {
				targets.push(normalisePath(path));
			}
		}

		const literalRe = /["'`](\/[a-zA-Z0-9_\-/:]+)["'`]/g;
		for (const m of src.matchAll(literalRe)) {
			const path = m[1];
			if (path && !path.startsWith("/api/")) {
				targets.push(normalisePath(path));
			}
		}

		const hasURLRe = /toHaveURL\(\s*\/((?:\\\/|[^/\\])+)\//g;
		for (const m of src.matchAll(hasURLRe)) {
			const reSrc = m[1];
			if (!reSrc) continue;
			const literal = reSrc
				.replace(/\\\//g, "/")
				.replace(/\[[^\]]+\][+*?]?/g, "x")
				.replace(/\(\?:[^)]+\)[+*?]?/g, "x")
				.replace(/[\^$]/g, "");
			if (literal.startsWith("/")) {
				targets.push(literal);
			}
		}
	}
	return targets;
}

function normalisePath(path: string): string {
	return path.replace(/\$\{[^}]+\}/g, "x").split(/[?#]/)[0] ?? "";
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

function isCovered(page: Page, targets: string[]): boolean {
	const re = routeToRegex(page.path);
	return targets.some((t) => re.test(t));
}

function main(): void {
	console.info("=== L3 Page Coverage Gate ===\n");

	const pages = discoverClientRoutes();
	const targets = discoverPlaywrightTargets();

	console.info(`Declared pages:     ${pages.length}`);
	console.info(`Playwright targets: ${targets.length}\n`);

	if (pages.length === 0) {
		console.info("✔ No pages declared — pass.\n");
		return;
	}

	const uncovered = pages.filter((p) => !isCovered(p, targets));

	if (uncovered.length === 0) {
		console.info(`✔ All ${pages.length} pages have at least one Playwright spec.\n`);
		return;
	}

	console.error(`❌ ${uncovered.length} page(s) have NO Playwright coverage:\n`);
	for (const p of uncovered) {
		console.error(`  ${p.path} (${p.source})`);
	}
	console.error("\nAdd a page.goto(...) in packages/ui/tests/ for each uncovered page.\n");
	process.exit(1);
}

main();
