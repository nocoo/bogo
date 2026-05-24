import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { vi } from "vitest";

export interface MockD1 {
	db: D1Database;
	mockPrepare: ReturnType<typeof vi.fn>;
	mockAll: ReturnType<typeof vi.fn>;
	mockFirst: ReturnType<typeof vi.fn>;
	mockRun: ReturnType<typeof vi.fn>;
	mockBind: ReturnType<typeof vi.fn>;
	mockBatch: ReturnType<typeof vi.fn>;
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
	const mockBatch = vi.fn().mockResolvedValue([]);
	const db = { prepare: mockPrepare, batch: mockBatch } as unknown as D1Database;

	return { db, mockPrepare, mockAll, mockFirst, mockRun, mockBind, mockBatch };
}

export function createSequenceD1(
	responses: Array<{ type: "all" | "first" | "run"; value: unknown }>,
) {
	let callIndex = 0;

	const createStatement = (): D1PreparedStatement => {
		const stmt = {
			bind: vi.fn().mockReturnThis(),
			all: vi.fn().mockImplementation(async () => {
				const resp = responses[callIndex++];
				return resp?.value ?? { results: [], success: true };
			}),
			first: vi.fn().mockImplementation(async () => {
				const resp = responses[callIndex++];
				return resp?.value ?? null;
			}),
			run: vi.fn().mockImplementation(async () => {
				const resp = responses[callIndex++];
				return resp?.value ?? { success: true, meta: { changes: 1 } };
			}),
		} as unknown as D1PreparedStatement;
		return stmt;
	};

	const prepare = vi.fn().mockImplementation(() => createStatement());
	const batch = vi.fn().mockResolvedValue([]);
	const db = { prepare, batch } as unknown as D1Database;
	return { db, prepare, batch };
}
