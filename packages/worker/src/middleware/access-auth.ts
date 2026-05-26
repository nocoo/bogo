import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../types.js";

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
	const host = c.req.header("host") || "";

	if (isLocalhost(host)) {
		c.set("userEmail", "dev@localhost");
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
		c.set("userEmail", (payload.email as string) || null);
	} catch {
		return c.json({ error: "Invalid Access JWT" }, 403);
	}

	c.set("accessAuthenticated", true);
	return next();
}
