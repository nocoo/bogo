import { BOGO_VERSION, type LiveResponse } from "@bogo/shared";
import type { Context } from "hono";
import type { AppEnv } from "../types.js";

const bootedAt = Date.now();

export async function liveRoute(c: Context<AppEnv>) {
	const timestamp = new Date().toISOString();
	const uptime = Math.round((Date.now() - bootedAt) / 1000);

	let dbHealthy = false;
	try {
		const row = await c.env.DB?.prepare("SELECT 1 AS probe").first<{ probe: number }>();
		dbHealthy = row?.probe === 1;
	} catch {
		dbHealthy = false;
	}

	const response: LiveResponse = {
		status: dbHealthy ? "ok" : "error",
		version: BOGO_VERSION,
		component: "worker",
		timestamp,
		uptime,
	};

	return c.json(response, dbHealthy ? 200 : 503, { "Cache-Control": "no-store" });
}
