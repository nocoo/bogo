import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createClient } from "./client.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createClient", () => {
	const client = createClient("http://localhost:8787");

	describe("request", () => {
		it("makes GET request with correct URL and headers", async () => {
			mockFetch.mockResolvedValue(
				new Response(JSON.stringify({ data: [{ id: "1" }] }), { status: 200 }),
			);

			const result = await client.request("/api/workspaces");
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:8787/api/workspaces", {
				headers: { "Content-Type": "application/json" },
				body: undefined,
			});
			expect(result).toEqual([{ id: "1" }]);
		});

		it("makes POST request with JSON body", async () => {
			mockFetch.mockResolvedValue(
				new Response(JSON.stringify({ data: { id: "new-1", name: "Test" } }), { status: 201 }),
			);

			const result = await client.request("/api/workspaces", {
				method: "POST",
				body: { name: "Test" },
			});
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:8787/api/workspaces", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: '{"name":"Test"}',
			});
			expect(result).toEqual({ id: "new-1", name: "Test" });
		});

		it("makes PUT request", async () => {
			mockFetch.mockResolvedValue(
				new Response(JSON.stringify({ data: { updated: true } }), { status: 200 }),
			);

			await client.request("/api/workspaces/ws-1", {
				method: "PUT",
				body: { name: "Updated" },
			});
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:8787/api/workspaces/ws-1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: '{"name":"Updated"}',
			});
		});

		it("makes DELETE request", async () => {
			mockFetch.mockResolvedValue(
				new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }),
			);

			const result = await client.request("/api/workspaces/ws-1", { method: "DELETE" });
			expect(result).toEqual({ deleted: true });
		});

		it("uses empty baseUrl by default", async () => {
			const defaultClient = createClient();
			mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

			await defaultClient.request("/api/workspaces");
			expect(mockFetch).toHaveBeenCalledWith("/api/workspaces", expect.any(Object));
		});

		it("merges custom headers", async () => {
			mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: null }), { status: 200 }));

			await client.request("/api/test", {
				headers: { "X-Custom": "value" },
			});
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:8787/api/test",
				expect.objectContaining({
					headers: { "Content-Type": "application/json", "X-Custom": "value" },
				}),
			);
		});
	});

	describe("error handling", () => {
		it("throws ApiError on non-ok response with JSON body", async () => {
			mockFetch.mockResolvedValue(
				new Response(
					JSON.stringify({ error: { code: "NOT_FOUND", message: "Workspace not found" } }),
					{ status: 404 },
				),
			);

			try {
				await client.request("/api/workspaces/missing");
				expect.fail("should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(ApiError);
				const err = e as ApiError;
				expect(err.status).toBe(404);
				expect(err.code).toBe("NOT_FOUND");
				expect(err.message).toBe("Workspace not found");
			}
		});

		it("throws ApiError with fallback message on non-JSON error response", async () => {
			mockFetch.mockResolvedValue(
				new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" }),
			);

			await expect(client.request("/api/fail")).rejects.toThrow(ApiError);
			try {
				await client.request("/api/fail");
			} catch (e) {
				const err = e as ApiError;
				expect(err.status).toBe(500);
				expect(err.code).toBe("UNKNOWN");
				expect(err.message).toBe("Internal Server Error");
			}
		});

		it("throws ApiError with code from error response", async () => {
			mockFetch.mockResolvedValue(
				new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR" } }), { status: 400 }),
			);

			try {
				await client.request("/api/bad");
			} catch (e) {
				const err = e as ApiError;
				expect(err.status).toBe(400);
				expect(err.code).toBe("VALIDATION_ERROR");
			}
		});
	});
});
