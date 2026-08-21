import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";
import type { AppEnv } from "../types";
import { AUTHOR_PROFILE_ENDPOINT, emailSha256Hex } from "../utils/author-profile";
import { meRoute } from "./me";

describe("GET /api/me", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function mockedFetch(): ReturnType<typeof vi.fn> {
		return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
	}

	it("returns email for localhost and looks up the public author profile", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify({ name: null, avatar: null }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const res = await app.request("/api/me", {
			headers: { host: "localhost:8787" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			data: { email: string; name: string | null; avatar: string | null };
		};
		expect(body.data).toEqual({ email: "dev@localhost", name: null, avatar: null });

		const hash = await emailSha256Hex("dev@localhost");
		expect(mockedFetch()).toHaveBeenCalledWith(
			`${AUTHOR_PROFILE_ENDPOINT}?hash=${hash}`,
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("passes through a published name and avatar", async () => {
		mockedFetch().mockResolvedValue(
			new Response(
				JSON.stringify({ name: "Zheng Li", avatar: "https://cdn.example/avatar-80.jpg" }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		const res = await app.request("/api/me", {
			headers: { host: "localhost:8787" },
		});
		const body = (await res.json()) as {
			data: { email: string; name: string | null; avatar: string | null };
		};
		expect(body.data).toEqual({
			email: "dev@localhost",
			name: "Zheng Li",
			avatar: "https://cdn.example/avatar-80.jpg",
		});
	});

	it("still returns email when the author profile lookup fails", async () => {
		mockedFetch().mockRejectedValue(new Error("network"));

		const res = await app.request("/api/me", {
			headers: { host: "localhost:8787" },
		});
		const body = (await res.json()) as {
			data: { email: string; name: string | null; avatar: string | null };
		};
		expect(body.data).toEqual({ email: "dev@localhost", name: null, avatar: null });
	});

	it("skips the author lookup when email is null", async () => {
		const json = vi.fn((body: unknown) => new Response(JSON.stringify(body)));
		const c = {
			get: () => null,
			json,
		} as unknown as Context<AppEnv>;

		await meRoute(c);

		expect(mockedFetch()).not.toHaveBeenCalled();
		expect(json).toHaveBeenCalledWith({ data: { email: null, name: null, avatar: null } });
	});
});
