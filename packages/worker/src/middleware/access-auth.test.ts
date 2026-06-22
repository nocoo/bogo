import type { Context, Next } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createMockD1, type MockD1 } from "../test-utils/mock-d1";
import type { AppEnv } from "../types.js";
import { sha256Hex } from "../utils/hash";
import { accessAuth, isLocalhost } from "./access-auth";

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

type CtxOptions = {
	host?: string;
	authorization?: string;
	cfAccessJwt?: string;
	path?: string;
	d1?: MockD1;
	env?: Partial<AppEnv["Bindings"]>;
};

type CapturedContext = {
	userEmail?: string | null;
	authMethod?: AppEnv["Variables"]["authMethod"];
	accessAuthenticated?: boolean;
};

function makeCtx(opts: CtxOptions = {}): {
	c: Context<AppEnv>;
	captured: CapturedContext;
	jsonMock: ReturnType<typeof vi.fn>;
	waitUntilMock: ReturnType<typeof vi.fn>;
} {
	const headers: Record<string, string> = {};
	if (opts.host !== undefined) headers.host = opts.host;
	if (opts.authorization !== undefined) headers.authorization = opts.authorization;
	if (opts.cfAccessJwt !== undefined) headers["cf-access-jwt-assertion"] = opts.cfAccessJwt;

	const captured: CapturedContext = {};
	const jsonMock = vi.fn((body: unknown, status?: number) => ({ body, status }));
	const waitUntilMock = vi.fn();

	const c = {
		req: {
			header: (name: string) => headers[name.toLowerCase()],
			path: opts.path ?? "/api/me",
		},
		env: {
			DB: opts.d1?.db,
			...opts.env,
		},
		executionCtx: { waitUntil: waitUntilMock },
		set: (key: keyof CapturedContext, value: unknown) => {
			(captured as Record<string, unknown>)[key] = value;
		},
		json: jsonMock,
	} as unknown as Context<AppEnv>;

	return { c, captured, jsonMock, waitUntilMock };
}

const NEXT_CALLED = Symbol("next");
const makeNext = (): { next: Next; calls: (typeof NEXT_CALLED)[] } => {
	const calls: (typeof NEXT_CALLED)[] = [];
	const next = (async () => {
		calls.push(NEXT_CALLED);
	}) as Next;
	return { next, calls };
};

describe("accessAuth — Bearer branch", () => {
	it("accepts a valid bogo_ bearer token, sets userEmail/authMethod, schedules last_used_at update, calls next", async () => {
		const plain = "bogo_validtoken1234";
		const hash = await sha256Hex(plain);
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: null,
			expires_at: null,
		});

		const { c, captured, waitUntilMock } = makeCtx({
			authorization: `Bearer ${plain}`,
			host: "bogo.hexly.ai",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(d1.mockPrepare).toHaveBeenCalledWith(
			"SELECT owner_email, revoked_at, expires_at FROM api_tokens WHERE token_hash = ?",
		);
		expect(d1.mockBind).toHaveBeenCalledWith(hash);
		expect(captured.userEmail).toBe("alice@example.com");
		expect(captured.authMethod).toBe("bearer");
		expect(captured.accessAuthenticated).toBe(true);
		expect(waitUntilMock).toHaveBeenCalledTimes(1);
		expect(calls).toEqual([NEXT_CALLED]);
	});

	it("rejects a bogo_ bearer whose row has non-null revoked_at with 401, does not call next", async () => {
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: "2026-06-22T00:00:00Z",
			expires_at: null,
		});

		const { c, jsonMock } = makeCtx({
			authorization: "Bearer bogo_revoked",
			host: "bogo.hexly.ai",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(jsonMock).toHaveBeenCalledWith({ error: "Invalid or revoked bearer token" }, 401);
		expect(calls).toEqual([]);
	});

	it("rejects a bogo_ bearer whose expires_at is in the past with 401, does not call next", async () => {
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: null,
			expires_at: "2020-01-01T00:00:00Z",
		});

		const { c, jsonMock } = makeCtx({
			authorization: "Bearer bogo_expired",
			host: "bogo.hexly.ai",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(jsonMock).toHaveBeenCalledWith({ error: "Invalid or revoked bearer token" }, 401);
		expect(calls).toEqual([]);
	});

	it("rejects a bogo_ bearer whose token_hash is not in the table with 401", async () => {
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce(null);

		const { c, jsonMock } = makeCtx({
			authorization: "Bearer bogo_notindb",
			host: "bogo.hexly.ai",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(jsonMock).toHaveBeenCalledWith({ error: "Invalid or revoked bearer token" }, 401);
		expect(calls).toEqual([]);
	});

	it("falls through to the CF Access path for non-bogo_ Bearer values (e.g. CF Access service token JWT)", async () => {
		// Non-bogo_ Bearer skips the bearer branch entirely. With no
		// Cf-Access-Jwt-Assertion header it lands on the "Missing Access JWT" 401,
		// proving the bearer branch did NOT intercept and DB was not queried.
		const d1 = createMockD1();
		const { c, jsonMock } = makeCtx({
			authorization: "Bearer eyJhbGciOi.notbogo.jwt",
			host: "bogo.hexly.ai",
			d1,
			env: { CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", CF_ACCESS_AUD: "aud-123" },
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(d1.mockPrepare).not.toHaveBeenCalled();
		expect(jsonMock).toHaveBeenCalledWith({ error: "Missing Access JWT" }, 401);
		expect(calls).toEqual([]);
	});

	it("on localhost host + valid bogo_ bearer, the bearer branch wins over the localhost shortcut", async () => {
		// This is the critical case: a revoked token in wrangler dev must still
		// 401, not fall through to dev@localhost. Here we use a valid token to
		// confirm the bearer branch runs (sets bearer/owner_email) instead of
		// the localhost branch (which would set dev@localhost/localhost).
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: null,
			expires_at: null,
		});

		const { c, captured } = makeCtx({
			authorization: "Bearer bogo_validlocal",
			host: "localhost:8787",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(captured.userEmail).toBe("alice@example.com");
		expect(captured.authMethod).toBe("bearer");
		expect(calls).toEqual([NEXT_CALLED]);
	});

	it("on localhost host with no Authorization header, the localhost branch sets dev@localhost/localhost and calls next", async () => {
		const { c, captured } = makeCtx({ host: "localhost:8787" });
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(captured.userEmail).toBe("dev@localhost");
		expect(captured.authMethod).toBe("localhost");
		expect(calls).toEqual([NEXT_CALLED]);
	});

	it("on /api/live with a revoked bogo_ bearer, still 401s (bearer branch precedes the live shortcut)", async () => {
		// Locks in the spec §3.1 footnote: even on the public /api/live route,
		// a CLI call carrying a revoked bearer must 401 instead of falling
		// through to the public exemption. This holds because the bearer
		// branch runs at the top of accessAuth, before path-based shortcuts.
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: "2026-06-22T00:00:00Z",
			expires_at: null,
		});

		const { c, jsonMock } = makeCtx({
			authorization: "Bearer bogo_revoked",
			host: "localhost:8787",
			path: "/api/live",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(jsonMock).toHaveBeenCalledWith({ error: "Invalid or revoked bearer token" }, 401);
		expect(calls).toEqual([]);
	});

	it("treats an empty-string revoked_at as revoked (strict !== null check)", async () => {
		// Defense against a future migration / hand-edit that stores "" instead
		// of NULL: the previous truthy/falsy check would have silently
		// re-authorized empty-string rows. Now any non-null revoked_at value —
		// including the empty string — is treated as revoked.
		const d1 = createMockD1();
		d1.mockFirst.mockResolvedValueOnce({
			owner_email: "alice@example.com",
			revoked_at: "" as unknown as string | null,
			expires_at: null,
		});

		const { c, jsonMock } = makeCtx({
			authorization: "Bearer bogo_emptyrevoked",
			host: "bogo.hexly.ai",
			d1,
		});
		const { next, calls } = makeNext();

		await accessAuth(c, next);

		expect(jsonMock).toHaveBeenCalledWith({ error: "Invalid or revoked bearer token" }, 401);
		expect(calls).toEqual([]);
	});
});
