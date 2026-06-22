import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash";

function nodeSha256Hex(s: string): string {
	return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("sha256Hex", () => {
	it("hashes the empty string to the canonical SHA-256 of empty input", async () => {
		expect(await sha256Hex("")).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	it("hashes ASCII input to the canonical SHA-256 hex", async () => {
		expect(await sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("hashes multi-byte UTF-8 input using its UTF-8 bytes (matches Node crypto)", async () => {
		const input = "你好世界";
		expect(await sha256Hex(input)).toBe(nodeSha256Hex(input));
	});

	it("hashes long input correctly (10KB)", async () => {
		const input = "x".repeat(10_000);
		expect(await sha256Hex(input)).toBe(nodeSha256Hex(input));
	});

	it("matches Node crypto SHA-256 hex byte-for-byte across mixed inputs", async () => {
		for (const input of [
			"bogo_a3f2x9b4c7d1",
			"the quick brown fox jumps over the lazy dog",
			"single-space-input",
		]) {
			expect(await sha256Hex(input)).toBe(nodeSha256Hex(input));
		}
	});
});
