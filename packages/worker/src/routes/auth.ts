import { generateId } from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { sha256Hex } from "../utils/hash.js";

export const authRoutes = new Hono<AppEnv>();

// GET /api/auth/cli — browser-login callback exchange for the bogo CLI.
//
// Must reject `authMethod === "bearer"`: a CLI token must never be able to
// mint another CLI token, or a leaked token would extend its own lifetime
// indefinitely and bypass CF Access revocation. Only a real human browser
// session (CF Access JWT) or a localhost dev session is allowed to land here.
//
// The `callback` query parameter must be a loopback URL with pathname
// `/callback` over HTTP — this matches the `cli-base` performLogin client
// which always binds 127.0.0.1 and listens on `/callback`. Anything else is
// rejected with 400 before any token is minted.
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

	const plain = generateToken();
	const hash = await sha256Hex(plain);
	const prefix = plain.slice(0, 12);

	// One active CLI token per identity. Revoke any prior cli-login token
	// for this owner before minting. This caps the blast radius of CSRF /
	// loop bugs / accidental re-runs of `bogo login`: the old token is
	// dead the instant a new one is issued, so a leaked token cannot
	// outlive its replacement, and the api_tokens table cannot grow
	// unboundedly for a single user.
	await c.env.DB.batch([
		c.env.DB.prepare(
			"UPDATE api_tokens SET revoked_at = ? WHERE owner_email = ? AND label = 'cli-login' AND revoked_at IS NULL",
		).bind(new Date().toISOString(), email),
		c.env.DB.prepare(
			"INSERT INTO api_tokens (id, owner_email, token_hash, prefix, label) VALUES (?, ?, ?, ?, ?)",
		).bind(generateId(), email, hash, prefix, "cli-login"),
	]);

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
