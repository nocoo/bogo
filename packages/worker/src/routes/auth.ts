import { generateId } from "@bogo/shared";
import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../types.js";
import { sha256Hex } from "../utils/hash.js";

export const authRoutes = new Hono<AppEnv>();

// GET /api/auth/cli — browser-mediated bearer token issuance for the bogo CLI.
//
// Two-stage flow (defense against drive-by CSRF on this side-effecting GET):
//
//   Stage 1 (no `confirm` query): render an HTML consent page and set a
//   SameSite=Strict, HttpOnly CSRF cookie. The form action is GET to this
//   same endpoint with `confirm=<csrf_token>` in the URL. Attacker pages
//   loaded cross-site cannot read the cookie and cannot construct a
//   matching `confirm` value, so a malicious <img src> / <script src> /
//   window.open against this URL stops at a no-op HTML response — no DB
//   write, no token issued.
//
//   Stage 2 (with `confirm=<csrf_token>` matching the cookie): verify both,
//   mint a bogo_* token, revoke any prior cli-login row for this owner
//   (one active per identity — bounds blast radius of any flow bug), and
//   302 to the loopback callback.
//
// Other invariants:
//   - authMethod must be cf-access-jwt or localhost; bearer callers are 403
//     so a leaked token cannot self-rotate (would defeat revocation).
//   - `callback` must be a loopback URL with pathname `/callback` over HTTP
//     (open-redirect guard; matches cli-base performLogin's bound surface).
authRoutes.get("/cli", async (c) => {
	const method = c.get("authMethod");
	if (method !== "cf-access-jwt" && method !== "localhost") {
		return c.json({ error: "CLI login requires browser session" }, 403);
	}

	const email = c.get("userEmail");
	if (!email) {
		return c.json({ error: "No authenticated user" }, 401);
	}

	const callback = c.req.query("callback") ?? "";
	const state = c.req.query("state") ?? "";
	if (!isLoopbackCallback(callback)) {
		return c.text("Invalid callback URL", 400);
	}

	const confirm = c.req.query("confirm");
	if (!confirm) {
		// Stage 1: render consent page + set CSRF cookie.
		const csrfToken = generateCsrfToken();
		setCookie(c, CSRF_COOKIE, csrfToken, {
			path: "/api/auth/cli",
			httpOnly: true,
			sameSite: "Strict",
			secure: c.req.url.startsWith("https://"),
			maxAge: 600, // 10 minutes — user must confirm before this expires
		});
		// Anti-clickjacking: the CSRF cookie defeats blind cross-site form
		// submission, but a third-party page could still iframe this consent
		// page and trick the user into clicking the (real) Authorize button.
		// `frame-ancestors 'none'` + the legacy XFO header refuse all
		// embedding; that is sufficient for the clickjacking threat. We do
		// NOT include `form-action 'self'` here because the consent flow
		// rides through Cloudflare Access, whose 302 chain trips up strict
		// form-action validation in some browsers and breaks the legitimate
		// submission. The CSRF cookie (HttpOnly + SameSite=Strict) is the
		// authoritative defense against forged submits.
		c.header("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'none'");
		c.header("X-Frame-Options", "DENY");
		return c.html(renderConsentHtml({ email, callback, state, csrfToken }));
	}

	// Stage 2: verify confirm matches the CSRF cookie.
	const cookieCsrf = getCookie(c, CSRF_COOKIE);
	if (!cookieCsrf || !constantTimeEqual(confirm, cookieCsrf)) {
		return c.text("Invalid or missing CSRF token", 403);
	}

	const plain = generateToken();
	const hash = await sha256Hex(plain);
	const prefix = plain.slice(0, 12);

	// One active CLI token per identity. Revoke any prior cli-login token
	// for this owner before minting. This caps the blast radius of any flow
	// bug (e.g., a future regression in the consent page) and bounds row
	// growth in api_tokens — there is no admin UI to clean up.
	await c.env.DB.batch([
		c.env.DB.prepare(
			"UPDATE api_tokens SET revoked_at = ? WHERE owner_email = ? AND label = 'cli-login' AND revoked_at IS NULL",
		).bind(new Date().toISOString(), email),
		c.env.DB.prepare(
			"INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)",
		).bind(generateId(), email, hash, prefix, "cli-login"),
	]);

	// Clear the CSRF cookie after use — it is single-shot.
	setCookie(c, CSRF_COOKIE, "", {
		path: "/api/auth/cli",
		httpOnly: true,
		sameSite: "Strict",
		secure: c.req.url.startsWith("https://"),
		maxAge: 0,
	});

	const redirect = new URL(callback);
	redirect.searchParams.set("api_key", plain);
	if (state) redirect.searchParams.set("state", state);
	redirect.searchParams.set("email", email);
	return c.redirect(redirect.toString(), 302);
});

export function isLoopbackCallback(raw: string): boolean {
	try {
		const u = new URL(raw);
		if (u.protocol !== "http:") return false;
		// Reject any userinfo (`http://evil.com@127.0.0.1/callback`). The URL
		// still resolves to loopback so it is not an exfiltration risk on its
		// own, but address-bar phishing combines well with userinfo so we
		// refuse on principle. The URL parser also normalises IPv4 aliases
		// (127.1, 0x7f000001, 2130706433) to "127.0.0.1", which is fine — they
		// genuinely point at loopback.
		if (u.username !== "" || u.password !== "") return false;
		if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return false;
		if (u.pathname !== "/callback") return false;
		return true;
	} catch {
		return false;
	}
}

function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const b64 = btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `bogo_${b64}`;
}

const CSRF_COOKIE = "bogo_cli_csrf";

function generateCsrfToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderConsentHtml(params: {
	email: string;
	callback: string;
	state: string;
	csrfToken: string;
}): string {
	const email = escapeHtml(params.email);
	const callback = escapeHtml(params.callback);
	const state = escapeHtml(params.state);
	const csrf = escapeHtml(params.csrfToken);
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize bogo CLI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #171717; color: #e5e5e5;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #1f1f1f; border: 1px solid #2a2a2a; border-radius: 12px;
      padding: 2rem; max-width: 440px; width: 90%;
    }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #fafafa; }
    p { font-size: 0.9rem; color: #a3a3a3; margin-bottom: 1rem; line-height: 1.5; }
    .email { color: #fafafa; font-weight: 500; }
    .callback {
      font-family: ui-monospace, monospace; font-size: 0.8rem;
      color: #737373; background: #0f0f0f; padding: 0.5rem 0.75rem;
      border-radius: 6px; word-break: break-all; margin-bottom: 1.5rem;
    }
    button {
      width: 100%; padding: 0.75rem 1rem; border: 0; border-radius: 8px;
      background: #c9a227; color: #171717; font-size: 0.95rem; font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #d4ae34; }
    .hint { font-size: 0.75rem; color: #525252; margin-top: 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize bogo CLI</h1>
    <p>Issue a long-lived API token to the CLI listening at:</p>
    <div class="callback">${callback}</div>
    <p>The token will be linked to <span class="email">${email}</span> and will replace any previous CLI token for this account.</p>
    <form method="GET" action="/api/auth/cli">
      <input type="hidden" name="callback" value="${callback}">
      <input type="hidden" name="state" value="${state}">
      <input type="hidden" name="confirm" value="${csrf}">
      <button type="submit">Authorize</button>
    </form>
    <p class="hint">If you did not run <code>bogo login</code>, close this tab.</p>
  </div>
</body>
</html>`;
}

// Re-exported only for unit tests.
export { constantTimeEqual as _constantTimeEqual };
export type _AuthContext = Context<AppEnv>;
