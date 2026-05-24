import { useQueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./app-providers.js";

describe("AppProviders", () => {
	it("provides a QueryClient to children", () => {
		const wrapper = ({ children }: { children: ReactNode }) => (
			<AppProviders>{children}</AppProviders>
		);
		const { result } = renderHook(() => useQueryClient(), { wrapper });
		expect(result.current).toBeDefined();
		expect(result.current.getDefaultOptions().queries?.staleTime).toBe(30_000);
	});
});
