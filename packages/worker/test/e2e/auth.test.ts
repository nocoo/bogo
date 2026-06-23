import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Full bearer auth lifecycle E2E for the bogo CLI flow.
//
// All D1 operations (including the revoke UPDATE) MUST use the same
// `--persist-to .wrangler/e2e` directory as global-setup.ts so the wrangler
// dev server actually sees the revoked row (a default-local UPDATE would
// silently miss and the "401 after revoke" assertion would always pass).
//
// `/api/auth/cli` is a two-stage flow (anti-CSRF, see routes/auth.ts):
// stage 1 returns HTML + Set-Cookie, stage 2 submits the form with a matching
// `confirm` token. `mintViaConsent` follows both steps from the same fetch
// context to keep tests honest about the real flow.

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = join(__dirname, "..", "..");
const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

async function mintViaConsent(opts: {
	callback: string;
	state?: string;
	authorization?: string;
}): Promise<Response> {
	const callbackQ = encodeURIComponent(opts.callback);
	const stateQ = opts.state ? `&state=${encodeURIComponent(opts.state)}` : "";
	const stage1Headers: Record<string, string> = {};
	if (opts.authorization) stage1Headers.authorization = opts.authorization;
	const stage1 = await fetch(`${BASE}/api/auth/cli?callback=${callbackQ}${stateQ}`, {
		headers: stage1Headers,
		redirect: "manual",
	});
	if (stage1.status !== 200) return stage1; // pass through error responses (403/400/etc)
	const body = await stage1.text();
	const csrf = body.match(/name="confirm" value="([0-9a-f]{64})"/)?.[1];
	if (!csrf) throw new Error(`stage 1 did not yield a CSRF token; body was: ${body}`);
	const cookie = (stage1.headers.get("set-cookie") ?? "").split(";")[0];
	const stage2Headers: Record<string, string> = { cookie };
	if (opts.authorization) stage2Headers.authorization = opts.authorization;
	return fetch(`${BASE}/api/auth/cli?callback=${callbackQ}${stateQ}&confirm=${csrf}`, {
		headers: stage2Headers,
		redirect: "manual",
	});
}

describe("GET /api/auth/cli", () => {
	it("stage 1 (no confirm): renders consent HTML and Set-Cookie with HttpOnly + SameSite=Strict", async () => {
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}&state=e2e-stage1`, {
			redirect: "manual",
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const body = await res.text();
		expect(body).toContain("Authorize bogo CLI");
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toMatch(/bogo_cli_csrf=/);
		expect(setCookie.toLowerCase()).toContain("httponly");
		expect(setCookie.toLowerCase()).toContain("samesite=strict");
	});

	it("stage 2 (confirm matches cookie): 302 with api_key / state / email", async () => {
		const res = await mintViaConsent({
			callback: "http://127.0.0.1:9999/callback",
			state: "e2e-stage2",
		});
		expect(res.status).toBe(302);
		const url = new URL(res.headers.get("location") as string);
		expect(url.hostname).toBe("127.0.0.1");
		expect(url.pathname).toBe("/callback");
		expect(url.searchParams.get("api_key")).toMatch(/^bogo_[A-Za-z0-9_-]+$/);
		expect(url.searchParams.get("state")).toBe("e2e-stage2");
		expect(typeof url.searchParams.get("email")).toBe("string");
	});

	it("stage 2 with confirm but no cookie → 403 (drive-by attacker without SameSite cookie)", async () => {
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const fakeConfirm = "a".repeat(64);
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}&confirm=${fakeConfirm}`, {
			redirect: "manual",
		});
		expect(res.status).toBe(403);
	});

	it("rejects a non-loopback callback with 400", async () => {
		const callback = encodeURIComponent("http://example.com:9999/callback");
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, { redirect: "manual" });
		expect(res.status).toBe(400);
	});

	it("rejects when callback parameter is missing with 400", async () => {
		const res = await fetch(`${BASE}/api/auth/cli`, { redirect: "manual" });
		expect(res.status).toBe(400);
	});
});

describe("bearer auth lifecycle (login → use → revoke → reject)", () => {
	it("mints a token via the consent flow, authorizes /api/me with it, revokes it via D1 UPDATE, then rejects the same bearer with 401", async () => {
		// Step 1 — drive the two-stage consent flow as the localhost dev session
		// and extract the minted api_key from the 302 redirect.
		const loginRes = await mintViaConsent({
			callback: "http://127.0.0.1:9999/callback",
			state: "lifecycle-state",
		});
		expect(loginRes.status).toBe(302);
		const location = loginRes.headers.get("location");
		expect(location).toBeTruthy();
		const url = new URL(location as string);
		const token = url.searchParams.get("api_key");
		expect(token).toMatch(/^bogo_[A-Za-z0-9_-]+$/);

		// Step 2 — present the bearer to /api/me; the bearer branch in
		// middleware/access-auth.ts must win over the localhost shortcut, so
		// the owner_email comes back as dev@localhost (the user the localhost
		// dev session was authenticated as when the token was minted).
		const meWithBearer = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(meWithBearer.status).toBe(200);
		const meBody = (await meWithBearer.json()) as { data: { email: string | null } };
		expect(meBody.data.email).toBe("dev@localhost");

		// Step 3 — revoke the token by prefix using a D1 UPDATE against the
		// same persisted directory the dev server is reading. `prefix` comes
		// from a restricted charset (`bogo_` + base64url), so the literal
		// concatenation here cannot inject SQL.
		const prefix = (token as string).slice(0, 12);
		execSync(
			`npx wrangler d1 execute bogo --local --persist-to .wrangler/e2e ` +
				`--command "UPDATE api_tokens SET revoked_at=datetime('now') WHERE prefix='${prefix}'"`,
			{ cwd: WORKER_ROOT, stdio: "ignore" },
		);

		// Step 4 — the same bearer now lands on the bearer branch's 401, NOT
		// on the localhost shortcut. This is the assertion that the bearer
		// branch is ordered correctly: otherwise the revoked token would be
		// silently rescued by `dev@localhost` and revocation would never bite.
		const meAfterRevoke = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(meAfterRevoke.status).toBe(401);
	});

	it("on localhost host with no Authorization header, /api/me still resolves to dev@localhost (localhost fallback intact)", async () => {
		const res = await fetch(`${BASE}/api/me`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { email: string | null } };
		expect(body.data.email).toBe("dev@localhost");
	});

	it("rejects /api/auth/cli with 403 when called via an existing bearer (prevents bearer self-minting)", async () => {
		// Mint one valid token via the localhost dev session.
		const loginRes = await mintViaConsent({ callback: "http://127.0.0.1:9999/callback" });
		expect(loginRes.status).toBe(302);
		const token = new URL(loginRes.headers.get("location") as string).searchParams.get("api_key");
		expect(token).toBeTruthy();

		// Replaying that bearer against /api/auth/cli must be refused at
		// stage 1 (bearer authMethod fails the check before the consent page
		// even renders), even though the bearer is otherwise valid for /api/me.
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const replay = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, {
			headers: { Authorization: `Bearer ${token}` },
			redirect: "manual",
		});
		expect(replay.status).toBe(403);
	});

	it("issuing a new CLI token revokes the prior cli-login token for the same owner", async () => {
		// Mint token A.
		const a = await mintViaConsent({ callback: "http://127.0.0.1:9999/callback" });
		expect(a.status).toBe(302);
		const tokenA = new URL(a.headers.get("location") as string).searchParams.get("api_key");
		expect(tokenA).toBeTruthy();

		// A is alive immediately after issue.
		const meA = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${tokenA}` },
		});
		expect(meA.status).toBe(200);

		// Mint token B via the same localhost dev session.
		const b = await mintViaConsent({ callback: "http://127.0.0.1:9999/callback" });
		expect(b.status).toBe(302);
		const tokenB = new URL(b.headers.get("location") as string).searchParams.get("api_key");
		expect(tokenB).toBeTruthy();
		expect(tokenB).not.toBe(tokenA);

		// A must now be revoked (one-active-per-identity).
		const meAAgain = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${tokenA}` },
		});
		expect(meAAgain.status).toBe(401);

		// B is alive.
		const meB = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${tokenB}` },
		});
		expect(meB.status).toBe(200);
	});
});
