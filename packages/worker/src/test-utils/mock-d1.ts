import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { vi } from "vitest";

export interface MockD1 {
	db: D1Database;
	mockPrepare: ReturnType<typeof vi.fn>;
	mockAll: ReturnType<typeof vi.fn>;
	mockFirst: ReturnType<typeof vi.fn>;
	mockRun: ReturnType<typeof vi.fn>;
	mockBind: ReturnType<typeof vi.fn>;
}

export function createMockD1(): MockD1 {
	const mockAll = vi.fn().mockResolvedValue({ results: [], success: true });
	const mockFirst = vi.fn().mockResolvedValue(null);
	const mockRun = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } } as D1Result);
	const mockBind = vi.fn();

	const statement = {
		bind: mockBind,
		all: mockAll,
		first: mockFirst,
		run: mockRun,
	} as unknown as D1PreparedStatement;

	mockBind.mockReturnValue(statement);

	const mockPrepare = vi.fn().mockReturnValue(statement);
	const db = { prepare: mockPrepare } as unknown as D1Database;

	return { db, mockPrepare, mockAll, mockFirst, mockRun, mockBind };
}
