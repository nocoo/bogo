import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractUserInfo, useUserInfo } from "./use-user-info";

describe("extractUserInfo", () => {
	it("returns the default user when email and name are missing", () => {
		expect(extractUserInfo(null)).toEqual({
			email: null,
			displayName: "User",
			initials: "U",
			avatarUrl: null,
		});
		expect(extractUserInfo({ email: null, name: null, avatar: null })).toEqual({
			email: null,
			displayName: "User",
			initials: "U",
			avatarUrl: null,
		});
	});

	it("prefers the published author name and avatar", () => {
		expect(
			extractUserInfo({
				email: "architie@gmail.com",
				name: "Zheng Li",
				avatar: "https://cdn.example/avatar-80.jpg",
			}),
		).toEqual({
			email: "architie@gmail.com",
			displayName: "Zheng Li",
			initials: "ZL",
			avatarUrl: "https://cdn.example/avatar-80.jpg",
		});
	});

	it("falls back to the email local part when the profile is a miss", () => {
		expect(
			extractUserInfo({
				email: "john.doe@example.com",
				name: null,
				avatar: null,
			}),
		).toEqual({
			email: "john.doe@example.com",
			displayName: "John Doe",
			initials: "JD",
			avatarUrl: null,
		});
	});

	it("uses the first two letters of a single-word local part", () => {
		expect(extractUserInfo({ email: "admin@test.com", name: null, avatar: null })).toEqual({
			email: "admin@test.com",
			displayName: "Admin",
			initials: "AD",
			avatarUrl: null,
		});
	});

	it("uses a published name without an email", () => {
		expect(extractUserInfo({ email: null, name: "Zheng Li", avatar: null })).toEqual({
			email: null,
			displayName: "Zheng Li",
			initials: "ZL",
			avatarUrl: null,
		});
		expect(extractUserInfo({ email: null, name: "Ann", avatar: null })).toEqual({
			email: null,
			displayName: "Ann",
			initials: "AN",
			avatarUrl: null,
		});
	});

	it("treats a blank avatar as missing", () => {
		expect(extractUserInfo({ email: "a@b.com", name: "Ann", avatar: "" }).avatarUrl).toBeNull();
	});

	it("falls back to User when the email has an empty local part", () => {
		expect(extractUserInfo({ email: "@example.com", name: null, avatar: null })).toEqual({
			email: "@example.com",
			displayName: "User",
			initials: "US",
			avatarUrl: null,
		});
	});
});

describe("useUserInfo", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ data: { email: "john.doe@example.com", name: null, avatar: null } }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns default before fetch", () => {
		vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => undefined));
		const { result } = renderHook(() => useUserInfo());
		expect(result.current.displayName).toBe("User");
		expect(result.current.initials).toBe("U");
		expect(result.current.avatarUrl).toBeNull();
	});

	it("extracts display name and initials from email", async () => {
		const { result } = renderHook(() => useUserInfo());
		await waitFor(() => {
			expect(result.current.email).toBe("john.doe@example.com");
		});
		expect(result.current.displayName).toBe("John Doe");
		expect(result.current.initials).toBe("JD");
		expect(result.current.avatarUrl).toBeNull();
	});

	it("uses the published author profile when present", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						email: "architie@gmail.com",
						name: "Zheng Li",
						avatar: "https://cdn.example/avatar-80.jpg",
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		const { result } = renderHook(() => useUserInfo());
		await waitFor(() => {
			expect(result.current.displayName).toBe("Zheng Li");
		});
		expect(result.current.initials).toBe("ZL");
		expect(result.current.avatarUrl).toBe("https://cdn.example/avatar-80.jpg");
	});

	it("handles single-word email local part", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ data: { email: "admin@test.com", name: null, avatar: null } }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		const { result } = renderHook(() => useUserInfo());
		await waitFor(() => {
			expect(result.current.email).toBe("admin@test.com");
		});
		expect(result.current.displayName).toBe("Admin");
		expect(result.current.initials).toBe("AD");
	});

	it("handles fetch failure gracefully", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
		const { result } = renderHook(() => useUserInfo());
		await new Promise((r) => setTimeout(r, 50));
		expect(result.current.displayName).toBe("User");
		expect(result.current.avatarUrl).toBeNull();
	});
});
