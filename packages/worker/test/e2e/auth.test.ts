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

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = join(__dirname, "..", "..");
const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

describe("GET /api/auth/cli", () => {
	it("returns 302 with api_key / state / email when called via localhost with a loopback callback", async () => {
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}&state=e2e-state`, {
			redirect: "manual",
		});
		expect(res.status).toBe(302);
		const location = res.headers.get("location");
		expect(location).toBeTruthy();
		const url = new URL(location as string);
		expect(url.hostname).toBe("127.0.0.1");
		expect(url.pathname).toBe("/callback");
		expect(url.searchParams.get("api_key")).toMatch(/^bogo_[A-Za-z0-9_-]+$/);
		expect(url.searchParams.get("state")).toBe("e2e-state");
		expect(typeof url.searchParams.get("email")).toBe("string");
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
	it("mints a token via /api/auth/cli, authorizes /api/me with it, revokes it via D1 UPDATE, then rejects the same bearer with 401", async () => {
		// Step 1 — call /api/auth/cli as the localhost dev session and extract
		// the minted api_key from the 302 redirect.
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const loginRes = await fetch(
			`${BASE}/api/auth/cli?callback=${callback}&state=lifecycle-state`,
			{ redirect: "manual" },
		);
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
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const loginRes = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, {
			redirect: "manual",
		});
		expect(loginRes.status).toBe(302);
		const token = new URL(loginRes.headers.get("location") as string).searchParams.get("api_key");
		expect(token).toBeTruthy();

		// Replaying that bearer against /api/auth/cli must be refused, even
		// though the bearer is otherwise valid for /api/me.
		const replay = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, {
			headers: { Authorization: `Bearer ${token}` },
			redirect: "manual",
		});
		expect(replay.status).toBe(403);
	});

	it("issuing a new CLI token revokes the prior cli-login token for the same owner", async () => {
		// Mint token A.
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const a = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, { redirect: "manual" });
		expect(a.status).toBe(302);
		const tokenA = new URL(a.headers.get("location") as string).searchParams.get("api_key");
		expect(tokenA).toBeTruthy();

		// A is alive immediately after issue.
		const meA = await fetch(`${BASE}/api/me`, {
			headers: { Authorization: `Bearer ${tokenA}` },
		});
		expect(meA.status).toBe(200);

		// Mint token B via the same localhost dev session.
		const b = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, { redirect: "manual" });
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
