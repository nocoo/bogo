import { availablePort, createTestWorker } from "../../../../tests/helpers/test-worker";

let fixture: ReturnType<typeof createTestWorker>;

export async function setup(): Promise<void> {
	const offenders = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CF_API_TOKEN"].filter(
		(key) => process.env[key],
	);
	if (offenders.length > 0) {
		throw new Error(`E2E isolation guard: refusing to start with ${offenders.join(", ")} set.`);
	}
	fixture = createTestWorker();
	try {
		const port = await availablePort();
		await fixture.start(port);
		process.env.BOGO_E2E_BASE = `http://127.0.0.1:${port}`;
		process.env.BOGO_E2E_CONFIG = fixture.config;
		process.env.BOGO_E2E_PERSIST = fixture.persist;
	} catch (error) {
		await fixture.stop();
		throw error;
	}
}

export async function teardown(): Promise<void> {
	await fixture.stop();
}
