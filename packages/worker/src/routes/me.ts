import type { Context } from "hono";
import type { AppEnv } from "../types.js";

export async function meRoute(c: Context<AppEnv>) {
	const email: string | null = c.get("userEmail") as string | null;
	return c.json({ data: { email } });
}
