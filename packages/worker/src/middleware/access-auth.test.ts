import { describe, expect, it } from "vitest";
import { isLocalhost } from "./access-auth";

describe("isLocalhost", () => {
	it("returns true for localhost", () => {
		expect(isLocalhost("localhost")).toBe(true);
		expect(isLocalhost("localhost:8787")).toBe(true);
	});

	it("returns true for 127.0.0.1", () => {
		expect(isLocalhost("127.0.0.1")).toBe(true);
		expect(isLocalhost("127.0.0.1:8787")).toBe(true);
	});

	it("returns true for *.dev.hexly.ai", () => {
		expect(isLocalhost("bogo.dev.hexly.ai")).toBe(true);
	});

	it("returns false for production domains", () => {
		expect(isLocalhost("bogo.hexly.ai")).toBe(false);
		expect(isLocalhost("example.com")).toBe(false);
	});
});
