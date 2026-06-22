import { describe, expect, it } from "vitest";
import app from "../index.js";
import { createMockD1 } from "../test-utils/mock-d1.js";
import { sha256Hex } from "../utils/hash.js";
import { isLoopbackCallback } from "./auth.js";

function makeRequest(path: string, init?: { host?: string; authorization?: string }) {
	const headers: Record<string, string> = {
		host: init?.host ?? "localhost:8787",
	};
	if (init?.authorization !== undefined) {
		headers.authorization = init.authorization;
	}
	return new Request(`http://${headers.host}${path}`, { method: "GET", headers });
}

describe("isLoopbackCallback", () => {
	it("accepts http://127.0.0.1:<port>/callback", () => {
		expect(isLoopbackCallback("http://127.0.0.1:9999/callback")).toBe(true);
	});

	it("accepts http://localhost:<port>/callback", () => {
		expect(isLoopbackCallback("http://localhost:9999/callback")).toBe(true);
	});

	it("accepts http://[::1]:<port>/callback", () => {
		expect(isLoopbackCallback("http://[::1]:9999/callback")).toBe(true);
	});

	it("rejects https:// protocol", () => {
		expect(isLoopbackCallback("https://127.0.0.1:9999/callback")).toBe(false);
	});

	it("rejects non-loopback host", () => {
		expect(isLoopbackCallback("http://example.com:9999/callback")).toBe(false);
	});

	it("rejects pathname other than /callback", () => {
		expect(isLoopbackCallback("http://127.0.0.1:9999/other")).toBe(false);
	});

	it("rejects malformed URLs", () => {
		expect(isLoopbackCallback("not-a-url")).toBe(false);
		expect(isLoopbackCallback("")).toBe(false);
	});

	it("rejects userinfo in the URL even when host resolves to loopback", () => {
		// `evil.com` here is the userinfo, not the host — URL parses this as
		// host=127.0.0.1. The flow is not exploitable on its own (the request
		// still goes to loopback) but we reject on principle because
		// address-bar phishing combines well with userinfo.
		expect(isLoopbackCallback("http://evil.com@127.0.0.1:9999/callback")).toBe(false);
		expect(isLoopbackCallback("http://user:pass@localhost:9999/callback")).toBe(false);
	});

	it("accepts IPv4 alias forms (127.1, 0x7f000001, 2130706433) — URL normalises to 127.0.0.1", () => {
		// These are legitimately loopback addresses; the URL parser normalises
		// hostname to "127.0.0.1" so they pass the allowlist. Documented as a
		// non-exploit per security review.
		expect(isLoopbackCallback("http://127.1:9999/callback")).toBe(true);
		expect(isLoopbackCallback("http://0x7f000001:9999/callback")).toBe(true);
		expect(isLoopbackCallback("http://2130706433:9999/callback")).toBe(true);
	});
});

describe("GET /api/auth/cli", () => {
	it("(a) localhost dev: 302 redirect with api_key / state / email in query", async () => {
		const { db, mockRun } = createMockD1();
		mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2F127.0.0.1%3A9999%2Fcallback&state=abc123", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(302);
		const location = res.headers.get("location");
		expect(location).toBeTruthy();
		const url = new URL(location as string);
		expect(url.protocol).toBe("http:");
		expect(url.hostname).toBe("127.0.0.1");
		expect(url.pathname).toBe("/callback");
		const apiKey = url.searchParams.get("api_key");
		expect(apiKey).toMatch(/^bogo_[A-Za-z0-9_-]+$/);
		expect(url.searchParams.get("state")).toBe("abc123");
		expect(url.searchParams.get("email")).toBe("dev@localhost");
	});

	it("(b) request with bearer authMethod is rejected with 403 (prevents bearer self-minting another token)", async () => {
		const { db, mockFirst, mockPrepare } = createMockD1();
		// Make the bearer branch in access-auth succeed so authMethod=="bearer".
		mockFirst.mockResolvedValue({
			owner_email: "alice@example.com",
			revoked_at: null,
			expires_at: null,
		});

		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2F127.0.0.1%3A9999%2Fcallback", {
				host: "bogo.hexly.ai",
				authorization: "Bearer bogo_validmintattempt",
			}),
			{ DB: db, ENVIRONMENT: "test" },
			{ waitUntil: () => {}, passThroughOnException: () => {} } as ExecutionContext,
		);
		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.error).toBe("CLI login requires browser session");
		// Negative assertion: no token was minted. Defends against a future
		// refactor that reorders mint-before-authMethod-check, which would
		// silently leak a token despite still returning 403.
		expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO api_tokens"));
	});

	it("(c) callback that is not loopback (public hostname) → 400", async () => {
		const { db } = createMockD1();
		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2Fexample.com%3A9999%2Fcallback", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(400);
	});

	it("(d) callback with pathname other than /callback → 400", async () => {
		const { db } = createMockD1();
		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2F127.0.0.1%3A9999%2Fother", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(400);
	});

	it("(e) callback with https protocol → 400", async () => {
		const { db } = createMockD1();
		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=https%3A%2F%2F127.0.0.1%3A9999%2Fcallback", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(400);
	});

	it("(f) callback parameter missing → 400", async () => {
		const { db } = createMockD1();
		const res = await app.fetch(makeRequest("/api/auth/cli", { host: "localhost:8787" }), {
			DB: db,
			ENVIRONMENT: "test",
		});
		expect(res.status).toBe(400);
	});

	it("(g) DB batch INSERTs sha256(api_key) — only the hash is persisted, never the plaintext", async () => {
		const { db, mockPrepare, mockBind, mockBatch } = createMockD1();
		mockBatch.mockResolvedValue([]);

		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2F127.0.0.1%3A9999%2Fcallback", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(302);
		const url = new URL(res.headers.get("location") as string);
		const plain = url.searchParams.get("api_key") as string;
		expect(plain).toMatch(/^bogo_[A-Za-z0-9_-]+$/);

		// Two prepares per issue: revoke same-owner cli-login rows, then INSERT.
		const prepareCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
		expect(prepareCalls).toContain(
			"UPDATE api_tokens SET revoked_at = ? WHERE owner_email = ? AND label = 'cli-login' AND revoked_at IS NULL",
		);
		expect(prepareCalls).toContain(
			"INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)",
		);
		// Both statements go through a single batch (atomic revoke+issue).
		expect(mockBatch).toHaveBeenCalledTimes(1);

		// The INSERT's bind args are the 5-arg call: [id, owner_email,
		// token_hash, prefix, label]. The UPDATE bind is the 2-arg call:
		// [iso_now, owner_email]. Find the 5-arg call and verify hashing.
		const insertBind = mockBind.mock.calls.find((c) => c.length === 5) as unknown[] | undefined;
		expect(insertBind).toBeTruthy();
		if (!insertBind) throw new Error("expected INSERT bind args");
		const [, ownerEmail, tokenHash, prefix, label] = insertBind as [
			string,
			string,
			string,
			string,
			string,
		];
		expect(ownerEmail).toBe("dev@localhost");
		expect(tokenHash).toBe(await sha256Hex(plain));
		expect(prefix).toBe(plain.slice(0, 12));
		expect(label).toBe("cli-login");
		// Plaintext token must NEVER appear in any bind() arg, anywhere.
		for (const call of mockBind.mock.calls) {
			for (const a of call) {
				expect(typeof a === "string" ? a : "").not.toBe(plain);
			}
		}
	});

	it("(h) issuing a new token revokes prior cli-login rows for the same owner (one active per identity)", async () => {
		const { db, mockPrepare, mockBatch } = createMockD1();
		mockBatch.mockResolvedValue([]);

		const res = await app.fetch(
			makeRequest("/api/auth/cli?callback=http%3A%2F%2F127.0.0.1%3A9999%2Fcallback", {
				host: "localhost:8787",
			}),
			{ DB: db, ENVIRONMENT: "test" },
		);
		expect(res.status).toBe(302);

		const prepareCalls = mockPrepare.mock.calls.map((c) => c[0] as string);
		const updateIdx = prepareCalls.indexOf(
			"UPDATE api_tokens SET revoked_at = ? WHERE owner_email = ? AND label = 'cli-login' AND revoked_at IS NULL",
		);
		const insertIdx = prepareCalls.indexOf(
			"INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)",
		);
		expect(updateIdx).toBeGreaterThanOrEqual(0);
		expect(insertIdx).toBeGreaterThanOrEqual(0);
		// UPDATE prepares before INSERT so the batch revokes-then-issues.
		expect(updateIdx).toBeLessThan(insertIdx);
	});
});
