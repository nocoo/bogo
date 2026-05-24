import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useFieldValues, validateFieldValue } from "./use-field-values.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

function err(status: number, code: string, message: string) {
	return new Response(JSON.stringify({ error: { code, message } }), { status });
}

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>{children}</WorkspaceProvider>
			</QueryClientProvider>
		);
	};
}

function useWithWorkspace(personId: string) {
	const ctx = useWorkspaceContext();
	const vm = useFieldValues(personId);
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const VALUE_1 = {
	id: "fv-1",
	workspaceId: "ws-1",
	personId: "p-1",
	fieldDefId: "fd-1",
	value: "Engineering",
};

const VALUE_2 = {
	id: "fv-2",
	workspaceId: "ws-1",
	personId: "p-1",
	fieldDefId: "fd-2",
	value: "Senior",
};

describe("validateFieldValue", () => {
	it("validates number: accepts finite numbers", () => {
		expect(validateFieldValue("42", "number", null)).toBeNull();
		expect(validateFieldValue("-3.14", "number", null)).toBeNull();
		expect(validateFieldValue("0", "number", null)).toBeNull();
	});

	it("validates number: rejects non-numbers", () => {
		expect(validateFieldValue("abc", "number", null)).toBe("Must be a valid finite number");
		expect(validateFieldValue("Infinity", "number", null)).toBe("Must be a valid finite number");
		expect(validateFieldValue("NaN", "number", null)).toBe("Must be a valid finite number");
	});

	it("validates number: rejects empty and whitespace-only", () => {
		expect(validateFieldValue("", "number", null)).toBe("Must be a valid finite number");
		expect(validateFieldValue("   ", "number", null)).toBe("Must be a valid finite number");
	});

	it("validates date: accepts YYYY-MM-DD", () => {
		expect(validateFieldValue("2026-05-24", "date", null)).toBeNull();
		expect(validateFieldValue("2026-01-31", "date", null)).toBeNull();
	});

	it("validates date: rejects bad format", () => {
		expect(validateFieldValue("05/24/2026", "date", null)).toBe(
			"Must be a valid date (YYYY-MM-DD)",
		);
	});

	it("validates date: rejects non-existent calendar date", () => {
		expect(validateFieldValue("2026-02-31", "date", null)).toBe(
			"Must be a valid date (YYYY-MM-DD)",
		);
		expect(validateFieldValue("2026-13-01", "date", null)).toBe(
			"Must be a valid date (YYYY-MM-DD)",
		);
	});

	it("validates date: rejects empty value", () => {
		expect(validateFieldValue("", "date", null)).toBe("Must be a valid date (YYYY-MM-DD)");
	});

	it("validates boolean: accepts true/false", () => {
		expect(validateFieldValue("true", "boolean", null)).toBeNull();
		expect(validateFieldValue("false", "boolean", null)).toBeNull();
	});

	it("validates boolean: rejects other values", () => {
		expect(validateFieldValue("yes", "boolean", null)).toBe("Must be true or false");
		expect(validateFieldValue("1", "boolean", null)).toBe("Must be true or false");
	});

	it("validates boolean: rejects empty value", () => {
		expect(validateFieldValue("", "boolean", null)).toBe("Must be true or false");
	});

	it("validates select: accepts value in options", () => {
		expect(validateFieldValue("Senior", "select", ["Junior", "Senior", "Staff"])).toBeNull();
	});

	it("validates select: rejects value not in options", () => {
		const result = validateFieldValue("Director", "select", ["Junior", "Senior"]);
		expect(result).toBe("Must be one of: Junior, Senior");
	});

	it("validates select: rejects when options is null", () => {
		expect(validateFieldValue("anything", "select", null)).toBe("Field has no options defined");
	});

	it("validates select: rejects empty value not in options", () => {
		expect(validateFieldValue("", "select", ["A", "B"])).toBe("Must be one of: A, B");
	});

	it("validates text: always passes including empty", () => {
		expect(validateFieldValue("anything", "text", null)).toBeNull();
		expect(validateFieldValue("", "text", null)).toBeNull();
	});
});

describe("useFieldValues", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useFieldValues("p-1"), { wrapper });
		expect(result.current.values).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches values for person after workspace selection", async () => {
		mockFetch.mockResolvedValue(ok([VALUE_1, VALUE_2]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.values).toHaveLength(2));
		expect(result.current.vm.values[0].value).toBe("Engineering");
	});

	it("exposes loading state", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(true));
	});

	it("exposes error on fetch failure", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB down"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.error).not.toBeNull());
		expect(result.current.vm.error?.message).toContain("DB down");
	});

	describe("getValueFor", () => {
		it("returns value for known field def", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			expect(result.current.vm.getValueFor("fd-1")).toBe("Engineering");
		});

		it("returns empty string for unknown field def", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			expect(result.current.vm.getValueFor("fd-unknown")).toBe("");
		});
	});

	describe("setValue", () => {
		it("optimistically updates existing value", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(ok({ personId: "p-1", fieldDefId: "fd-1", value: "Product" }))
				.mockResolvedValueOnce(ok([{ ...VALUE_1, value: "Product" }]));

			act(() => result.current.vm.setValue("fd-1", "Product"));

			await waitFor(() => expect(result.current.vm.getValueFor("fd-1")).toBe("Product"));
		});

		it("optimistically adds new value entry", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(ok({ personId: "p-1", fieldDefId: "fd-1", value: "New" }))
				.mockResolvedValueOnce(ok([{ ...VALUE_1, value: "New" }]));

			act(() => result.current.vm.setValue("fd-1", "New"));

			await waitFor(() => expect(result.current.vm.getValueFor("fd-1")).toBe("New"));
		});

		it("rolls back on server error", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Invalid value"))
				.mockResolvedValueOnce(ok([VALUE_1]));

			act(() => result.current.vm.setValue("fd-1", "bad"));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			expect(result.current.vm.mutationError?.message).toContain("Invalid value");
			expect(result.current.vm.values[0].value).toBe("Engineering");
		});

		it("exposes isSaving state", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.setValue("fd-1", "X"));

			await waitFor(() => expect(result.current.vm.isSaving).toBe(true));
		});
	});

	describe("validate", () => {
		it("delegates to validateFieldValue with field def info", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const def = {
				id: "fd-1",
				workspaceId: "ws-1",
				name: "Count",
				fieldType: "number" as const,
				options: null,
				sortOrder: 0,
				required: false,
				defaultValue: null,
				createdAt: "2026-01-01",
			};

			expect(result.current.vm.validate(def, "abc")).toBe("Must be a valid finite number");
			expect(result.current.vm.validate(def, "42")).toBeNull();
		});
	});

	describe("clearMutationError", () => {
		it("clears the error", async () => {
			mockFetch.mockResolvedValue(ok([VALUE_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.values).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Bad"))
				.mockResolvedValueOnce(ok([VALUE_1]));
			act(() => result.current.vm.setValue("fd-1", "x"));
			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());

			act(() => result.current.vm.clearMutationError());
			expect(result.current.vm.mutationError).toBeNull();
		});
	});

	describe("workspace scoping", () => {
		it("sends requests scoped to workspace and person", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("p-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/w/ws-1/fields/values/p-1"),
				expect.anything(),
			);
		});
	});
});
