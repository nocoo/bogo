import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../types.js";
import { sha256Hex } from "../utils/hash.js";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTeamDomain: string | null = null;

function getJWKS(teamDomain: string) {
	if (jwksCache && jwksCacheTeamDomain === teamDomain) {
		return jwksCache;
	}
	jwksCache = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
	jwksCacheTeamDomain = teamDomain;
	return jwksCache;
}

export function isLocalhost(host: string): boolean {
	return (
		host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.endsWith(".dev.hexly.ai")
	);
}

export async function accessAuth(c: Context<AppEnv>, next: Next) {
	// Bearer branch must run BEFORE the localhost shortcut so a revoked bogo_*
	// token on wrangler dev still 401s instead of falling through to
	// dev@localhost. Non-bogo_ Bearer values (e.g. CF Access service token
	// JWTs) skip this branch and fall through to the CF Access path.
	const auth = c.req.header("Authorization") ?? "";
	if (auth.startsWith("Bearer bogo_")) {
		const plain = auth.slice("Bearer ".length);
		const hash = await sha256Hex(plain);
		const row = await c.env.DB.prepare(
			"SELECT owner_email, revoked_at, expires_at FROM api_tokens WHERE token_hash = ?",
		)
			.bind(hash)
			.first<{
				owner_email: string;
				revoked_at: string | null;
				expires_at: string | null;
			}>();
		if (
			!row ||
			row.revoked_at !== null ||
			(row.expires_at !== null && row.expires_at < new Date().toISOString())
		) {
			return c.json({ error: "Invalid or revoked bearer token" }, 401);
		}
		c.executionCtx.waitUntil(
			c.env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
				.bind(new Date().toISOString(), hash)
				.run()
				.catch((err) => {
					// Best-effort timestamp update; never block the request.
					// Surface failures so a stuck last_used_at — the only forensic
					// signal for "is this token alive?" — does not go unnoticed.
					console.error("[access-auth] last_used_at update failed:", err);
				}),
		);
		c.set("userEmail", row.owner_email);
		c.set("authMethod", "bearer");
		c.set("accessAuthenticated", true);
		return next();
	}

	const host = c.req.header("host") || "";

	if (isLocalhost(host)) {
		c.set("userEmail", "dev@localhost");
		c.set("authMethod", "localhost");
		return next();
	}

	if (c.req.path === "/api/live") {
		return next();
	}

	const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
	const aud = c.env.CF_ACCESS_AUD;

	if (!(teamDomain && aud)) {
		return c.json(
			{
				error: "Access authentication not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.",
			},
			500,
		);
	}

	const jwt = c.req.header("Cf-Access-Jwt-Assertion");
	if (!jwt) {
		return c.json({ error: "Missing Access JWT" }, 401);
	}

	try {
		const jwks = getJWKS(teamDomain);
		const { payload } = await jwtVerify(jwt, jwks, {
			issuer: `https://${teamDomain}`,
			audience: aud,
		});
		c.set("userEmail", (payload.email as string) || (payload.common_name as string) || null);
		c.set("authMethod", "cf-access-jwt");
	} catch {
		return c.json({ error: "Invalid Access JWT" }, 403);
	}

	c.set("accessAuthenticated", true);
	return next();
}
