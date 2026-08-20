import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "../../seeds/northwind-labs.sql");

const PEOPLE = [
	"Wei Chen",
	"Mina Park",
	"Lina Rossi",
	"Omar Haddad",
	"Theo Alvarez",
	"Priya Shah",
	"Sam Okonkwo",
	"Jonah Reed",
	"Aiko Tanaka",
	"Harper Quinn",
];

const DOCS = [
	"1:1 Mina / Theo — staffing the search rewrite",
	"1:1 Mina / Priya — team health",
	"Q3 planning — search + onboarding",
	"Theo Alvarez — Staff promo packet",
	"Search empty-state design review",
	"Jonah Reed — 30-day check-in",
];

describe("northwind-labs seed sql", () => {
	const sql = readFileSync(SEED, "utf8");

	it("is local-only and idempotent", () => {
		expect(sql).toContain("PRAGMA foreign_keys = OFF");
		expect(sql).toContain("PRAGMA foreign_keys = ON");
		expect(sql).toContain("DELETE FROM workspaces");
		expect(sql).toContain("DELETE FROM document_types");
		expect(sql).toContain("Northwind Labs");
		expect(sql).toContain("--remote");
		expect(sql).not.toMatch(/wrangler d1 .*--remote/);
	});

	it("inserts the connected fixture", () => {
		for (const name of PEOPLE) {
			expect(sql).toContain(name);
		}
		for (const title of DOCS) {
			expect(sql).toContain(title);
		}
		expect(sql).toContain("dotted_manager_id");
		expect(sql).toContain("00000000-0000-4000-a000-000000000103");
		expect(sql).toContain("'Engineering'");
		expect(sql).toContain("All People");
	});
});
