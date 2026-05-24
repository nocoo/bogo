import { describe, expect, it, vi } from "vitest";
import { detectCycle } from "./persons.js";

function createChainDB(chain: Record<string, string | null>) {
	const prepare = vi.fn().mockReturnValue({
		bind: vi.fn().mockReturnThis(),
		first: vi.fn().mockImplementation(async () => {
			const args = prepare.mock.calls[prepare.mock.calls.length - 1];
			const stmt = args[0] as string;
			if (!stmt.includes("manager_id")) {
				return null;
			}
			const bindCalls = prepare.mock.results[prepare.mock.results.length - 1].value.bind.mock.calls;
			const nodeId = bindCalls[bindCalls.length - 1][0] as string;
			const managerId = chain[nodeId];
			if (managerId === undefined) {
				return null;
			}
			return { manager_id: managerId };
		}),
	});
	return { prepare } as unknown as D1Database;
}

describe("detectCycle", () => {
	it("returns false for a simple valid move", async () => {
		// Tree: A -> B -> C. Moving C under A is valid.
		const db = createChainDB({ A: null, B: "A", C: "B" });
		const result = await detectCycle(db, "ws-1", "C", "A");
		expect(result).toBe(false);
	});

	it("detects direct cycle (moving parent under child)", async () => {
		// Tree: A -> B. Moving A under B creates A -> B -> A
		const db = createChainDB({ A: null, B: "A" });
		const result = await detectCycle(db, "ws-1", "A", "B");
		expect(result).toBe(true);
	});

	it("detects indirect cycle (moving ancestor under descendant)", async () => {
		// Tree: A -> B -> C -> D. Moving A under D creates cycle
		const db = createChainDB({ A: null, B: "A", C: "B", D: "C" });
		const result = await detectCycle(db, "ws-1", "A", "D");
		expect(result).toBe(true);
	});

	it("returns false when new manager is root", async () => {
		// Moving B under root (null parent) — no cycle possible
		const db = createChainDB({ root: null, B: "root" });
		const result = await detectCycle(db, "ws-1", "B", "root");
		expect(result).toBe(false);
	});
});
