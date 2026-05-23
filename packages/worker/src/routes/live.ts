import { BOGO_VERSION, type LiveResponse } from "@bogo/shared";
import type { Context } from "hono";
import type { AppEnv } from "../types.js";

const bootedAt = Date.now();

export async function liveRoute(c: Context<AppEnv>) {
	const timestamp = new Date().toISOString();
	const uptime = Math.round((Date.now() - bootedAt) / 1000);

	const response: LiveResponse = {
		status: "ok",
		version: BOGO_VERSION,
		component: "worker",
		timestamp,
		uptime,
	};

	return c.json(response, 200, { "Cache-Control": "no-store" });
}
