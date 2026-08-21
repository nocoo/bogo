import type { Context } from "hono";
import type { AppEnv } from "../types.js";
import { lookupAuthorProfile } from "../utils/author-profile.js";

export async function meRoute(c: Context<AppEnv>) {
	const email: string | null = c.get("userEmail") as string | null;
	const profile = email ? await lookupAuthorProfile(email) : { name: null, avatar: null };
	return c.json({ data: { email, name: profile.name, avatar: profile.avatar } });
}
