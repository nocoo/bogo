import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { testEnvironment, waitForHealthyWorker } from "../helpers/test-worker";

describe("test Worker readiness", () => {
	for (const status of [200, 401, 503]) {
		test(`accepts only a healthy Worker, not HTTP ${status} alone`, async () => {
			const server = createServer((_request, response) => {
				response.writeHead(status, { "Content-Type": "application/json" });
				response.end(
					JSON.stringify({ status: status === 200 ? "ok" : "error", component: "worker" }),
				);
			});
			server.listen(0, "127.0.0.1");
			await once(server, "listening");
			const address = server.address();
			if (!address || typeof address === "string") throw new Error("Missing fixture address");
			const child = spawn("bun", ["-e", "setInterval(() => {}, 1000)"]);
			try {
				const ready = waitForHealthyWorker(
					`http://127.0.0.1:${address.port}`,
					child,
					() => "owned fixture stderr",
					250,
				);
				if (status === 200) await ready;
				else await expect(ready).rejects.toThrow(`HTTP ${status}`);
			} finally {
				const exited = once(child, "exit");
				child.kill();
				await exited;
				server.closeAllConnections();
				await new Promise<void>((done) => server.close(() => done()));
			}
		});
	}

	test("reports early process failure with its diagnostic log", async () => {
		const child = spawn("bun", ["-e", "process.exit(42)"]);
		await once(child, "exit");
		await expect(
			waitForHealthyWorker("http://127.0.0.1:1", child, () => "startup configuration rejected"),
		).rejects.toThrow("Test Worker exited (42): startup configuration rejected");
	});

	test("does not inherit provider credentials or personal home", () => {
		const env = testEnvironment("/owned/test/home");
		expect(env.HOME).toBe("/owned/test/home");
		for (const key of [
			"CLOUDFLARE_API_TOKEN",
			"CF_API_TOKEN",
			"CLOUDFLARE_ACCOUNT_ID",
			"CF_ACCESS_TEAM_DOMAIN",
			"CF_ACCESS_AUD",
		]) {
			expect(env).not.toHaveProperty(key);
		}
	});
});
