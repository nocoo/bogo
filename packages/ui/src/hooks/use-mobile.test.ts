import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
	let listeners: Array<() => void>;
	let mockMql: {
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		listeners = [];
		mockMql = {
			addEventListener: vi.fn((_event: string, cb: () => void) => {
				listeners.push(cb);
			}),
			removeEventListener: vi.fn(),
		};
		vi.stubGlobal("matchMedia", () => mockMql);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns true when window width < 768", () => {
		vi.stubGlobal("innerWidth", 500);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(true);
	});

	it("returns false when window width >= 768", () => {
		vi.stubGlobal("innerWidth", 1024);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(false);
	});

	it("updates when media query fires change event", () => {
		vi.stubGlobal("innerWidth", 1024);
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(false);

		vi.stubGlobal("innerWidth", 500);
		act(() => {
			for (const cb of listeners) {
				cb();
			}
		});
		expect(result.current).toBe(true);
	});

	it("cleans up event listener on unmount", () => {
		vi.stubGlobal("innerWidth", 1024);
		const { unmount } = renderHook(() => useIsMobile());
		unmount();
		expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
	});
});
