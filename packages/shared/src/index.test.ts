import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOGO_VERSION } from "./index";

describe("shared", () => {
	it("BOGO_VERSION matches package.json", () => {
		const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));
		expect(BOGO_VERSION).toBe(pkg.version);
	});
});
