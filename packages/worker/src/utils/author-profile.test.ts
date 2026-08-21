import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AUTHOR_PROFILE_ENDPOINT,
	emailSha256Hex,
	lookupAuthorProfile,
	normalizeEmail,
} from "./author-profile";

const ZHENG_EMAIL = "architie@gmail.com";
const ZHENG_HASH = "7ba563171c26fb9b82e9f7750840c0455602eb35025192027230bcb40aae1217";

describe("normalizeEmail", () => {
	it("trims and lowercases", () => {
		expect(normalizeEmail("  Architie@Gmail.com  ")).toBe(ZHENG_EMAIL);
	});
});

describe("emailSha256Hex", () => {
	it("hashes the canonical author email to the published SHA-256 hex", async () => {
		expect(await emailSha256Hex(ZHENG_EMAIL)).toBe(ZHENG_HASH);
	});

	it("normalizes before hashing so mixed-case and padding match", async () => {
		expect(await emailSha256Hex("  Architie@Gmail.com  ")).toBe(ZHENG_HASH);
	});
});

describe("lookupAuthorProfile", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function mockedFetch(): ReturnType<typeof vi.fn> {
		return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
	}

	it("GETs the profile endpoint with the email SHA-256 hex", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify({ name: "Zheng Li", avatar: "https://cdn.example/a.jpg" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const profile = await lookupAuthorProfile(ZHENG_EMAIL);

		expect(profile).toEqual({ name: "Zheng Li", avatar: "https://cdn.example/a.jpg" });
		expect(mockedFetch()).toHaveBeenCalledTimes(1);
		const [url, init] = mockedFetch().mock.calls[0] as [string, RequestInit];
		expect(url).toBe(`${AUTHOR_PROFILE_ENDPOINT}?hash=${ZHENG_HASH}`);
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("returns null name and avatar on a published miss", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify({ name: null, avatar: null }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		expect(await lookupAuthorProfile("nobody@example.com")).toEqual({
			name: null,
			avatar: null,
		});
	});

	it("returns nulls on 429", async () => {
		mockedFetch().mockResolvedValue(new Response("too many requests", { status: 429 }));
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});

	it("returns nulls when fetch throws", async () => {
		mockedFetch().mockRejectedValue(new Error("network"));
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});

	it("returns nulls when the response body is not JSON", async () => {
		mockedFetch().mockResolvedValue(new Response("not-json", { status: 200 }));
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});

	it("returns nulls when the body is not an object", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify(null), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});

	it("returns nulls when the body is a JSON array", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify(["nope"]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});

	it("coerces non-string name and avatar to null", async () => {
		mockedFetch().mockResolvedValue(
			new Response(JSON.stringify({ name: 1, avatar: { url: "x" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		expect(await lookupAuthorProfile(ZHENG_EMAIL)).toEqual({ name: null, avatar: null });
	});
});
