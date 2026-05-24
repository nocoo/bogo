import type { Person } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { computeTreeLayout, findDropTarget, wouldCreateCycle } from "./person-tree-layout.js";

const ROOT: Person = {
	id: "p-root",
	workspaceId: "ws-1",
	name: "Org",
	title: "Root",
	managerId: null,
	dottedManagerId: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const ALICE: Person = {
	id: "p-alice",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Engineer",
	managerId: "p-root",
	dottedManagerId: null,
	isRoot: false,
	sortOrder: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

const BOB: Person = {
	id: "p-bob",
	workspaceId: "ws-1",
	name: "Bob",
	title: "Designer",
	managerId: "p-alice",
	dottedManagerId: "p-root",
	isRoot: false,
	sortOrder: 2,
	createdAt: "2026-01-03",
	updatedAt: "2026-01-03",
};

describe("computeTreeLayout", () => {
	it("returns empty arrays for empty input", () => {
		const result = computeTreeLayout([]);
		expect(result.nodes).toEqual([]);
		expect(result.edges).toEqual([]);
	});

	it("computes positions for a single root node", () => {
		const { nodes, edges } = computeTreeLayout([ROOT]);
		expect(nodes).toHaveLength(1);
		expect(nodes[0].id).toBe("p-root");
		expect(nodes[0].type).toBe("person");
		expect(nodes[0].data.person).toEqual(ROOT);
		expect(typeof nodes[0].position.x).toBe("number");
		expect(typeof nodes[0].position.y).toBe("number");
		expect(edges).toHaveLength(0);
	});

	it("creates solid edges for managerId relationships", () => {
		const { nodes, edges } = computeTreeLayout([ROOT, ALICE]);
		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);
		expect(edges[0]).toEqual({
			id: "e-p-root-p-alice",
			source: "p-root",
			target: "p-alice",
		});
	});

	it("creates dashed edges for dottedManagerId relationships", () => {
		const { edges } = computeTreeLayout([ROOT, ALICE, BOB]);
		const dottedEdge = edges.find((e) => e.id.startsWith("d-"));
		expect(dottedEdge).toEqual({
			id: "d-p-root-p-bob",
			source: "p-root",
			target: "p-bob",
			style: { strokeDasharray: "5 5" },
			animated: true,
		});
	});

	it("produces hierarchical y positions (root above children)", () => {
		const { nodes } = computeTreeLayout([ROOT, ALICE, BOB]);
		const rootNode = nodes.find((n) => n.id === "p-root");
		const aliceNode = nodes.find((n) => n.id === "p-alice");
		const bobNode = nodes.find((n) => n.id === "p-bob");
		expect(rootNode?.position.y).toBeLessThan(aliceNode?.position.y ?? 0);
		expect(aliceNode?.position.y).toBeLessThan(bobNode?.position.y ?? 0);
	});
});

describe("findDropTarget", () => {
	const nodes = [
		{ id: "n1", position: { x: 0, y: 0 }, data: { person: ROOT }, type: "person" as const },
		{ id: "n2", position: { x: 300, y: 0 }, data: { person: ALICE }, type: "person" as const },
	];

	it("returns closest node within threshold", () => {
		const target = findDropTarget("n2", { x: 120, y: 40 }, nodes);
		expect(target).toBe("n1");
	});

	it("returns null when no node within threshold", () => {
		const target = findDropTarget("n2", { x: 1000, y: 1000 }, nodes);
		expect(target).toBeNull();
	});

	it("does not return the dragged node itself", () => {
		const target = findDropTarget("n1", { x: 120, y: 40 }, nodes);
		expect(target).not.toBe("n1");
	});

	it("respects custom threshold", () => {
		const target = findDropTarget("n2", { x: 200, y: 40 }, nodes, 50);
		expect(target).toBeNull();
	});
});

describe("wouldCreateCycle", () => {
	it("detects direct cycle (moving parent under child)", () => {
		expect(wouldCreateCycle("p-root", "p-alice", [ROOT, ALICE, BOB])).toBe(true);
	});

	it("detects indirect cycle (moving grandparent under grandchild)", () => {
		expect(wouldCreateCycle("p-root", "p-bob", [ROOT, ALICE, BOB])).toBe(true);
	});

	it("returns false for valid move (no cycle)", () => {
		expect(wouldCreateCycle("p-bob", "p-root", [ROOT, ALICE, BOB])).toBe(false);
	});

	it("returns false when new manager has no parent chain to person", () => {
		const charlie: Person = {
			...ALICE,
			id: "p-charlie",
			name: "Charlie",
			managerId: "p-root",
		};
		expect(wouldCreateCycle("p-alice", "p-charlie", [ROOT, ALICE, BOB, charlie])).toBe(false);
	});
});
