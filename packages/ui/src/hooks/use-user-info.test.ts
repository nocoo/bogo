import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserInfo } from "./use-user-info";

describe("useUserInfo", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: { email: "john.doe@example.com" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns default before fetch", () => {
		const { result } = renderHook(() => useUserInfo());
		expect(result.current.displayName).toBe("User");
		expect(result.current.initials).toBe("U");
	});

	it("extracts display name and initials from email", async () => {
		const { result } = renderHook(() => useUserInfo());
		await waitFor(() => {
			expect(result.current.email).toBe("john.doe@example.com");
		});
		expect(result.current.displayName).toBe("John Doe");
		expect(result.current.initials).toBe("JD");
	});

	it("handles single-word email local part", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: { email: "admin@test.com" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
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
	});
});
