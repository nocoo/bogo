import type { Person } from "@bogo/shared";
import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 240;
const NODE_HEIGHT_BASE = 80;
const FIELD_ROW_HEIGHT = 16;

/** Chart-visible custom field row rendered under a person's name/title.
 * Rows arrive in the order the caller wants them shown (usually the
 * field def's `sortOrder`). Empty values are the caller's call to
 * include or omit — layout treats every entry as a rendered row. */
export interface ChartFieldRow {
	fieldDefId: string;
	name: string;
	value: string;
}

export interface PersonNodeData extends Record<string, unknown> {
	person: Person;
	fields: ChartFieldRow[];
}

export type PersonNode = Node<PersonNodeData, "person">;
export type PersonEdge = Edge;

/** Height Dagre reserves for a node. Kept in sync with the DOM height
 * PersonNode actually renders — otherwise edges land in the middle of
 * text. Base = avatar row; each extra field row adds FIELD_ROW_HEIGHT. */
export function computeNodeHeight(fieldRowCount: number): number {
	return NODE_HEIGHT_BASE + fieldRowCount * FIELD_ROW_HEIGHT;
}

export function computeTreeLayout(
	persons: Person[],
	fieldsByPerson?: Map<string, ChartFieldRow[]>,
): {
	nodes: PersonNode[];
	edges: PersonEdge[];
} {
	if (persons.length === 0) {
		return { nodes: [], edges: [] };
	}

	const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

	const heights = new Map<string, number>();
	for (const p of persons) {
		const rows = fieldsByPerson?.get(p.id) ?? [];
		const h = computeNodeHeight(rows.length);
		heights.set(p.id, h);
		g.setNode(p.id, { width: NODE_WIDTH, height: h });
	}
	for (const p of persons) {
		if (p.managerId) {
			g.setEdge(p.managerId, p.id);
		}
	}

	Dagre.layout(g);

	const nodes: PersonNode[] = persons.map((p) => {
		const pos = g.node(p.id);
		const h = heights.get(p.id) ?? NODE_HEIGHT_BASE;
		return {
			id: p.id,
			position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2 },
			data: { person: p, fields: fieldsByPerson?.get(p.id) ?? [] },
			type: "person",
		};
	});

	const edges: PersonEdge[] = [];
	for (const p of persons) {
		if (p.managerId) {
			edges.push({
				id: `e-${p.managerId}-${p.id}`,
				source: p.managerId,
				target: p.id,
			});
		}
		if (p.dottedManagerId) {
			edges.push({
				id: `d-${p.dottedManagerId}-${p.id}`,
				source: p.dottedManagerId,
				target: p.id,
				style: { strokeDasharray: "5 5", opacity: 0.6 },
			});
		}
	}

	return { nodes, edges };
}

export function findDropTarget(
	draggedId: string,
	dropPosition: { x: number; y: number },
	nodes: PersonNode[],
	threshold = 100,
): string | null {
	let closest: { id: string; distance: number } | null = null;

	for (const node of nodes) {
		if (node.id === draggedId) {
			continue;
		}
		const cx = node.position.x + NODE_WIDTH / 2;
		const cy = node.position.y + computeNodeHeight(node.data.fields.length) / 2;
		const dx = dropPosition.x - cx;
		const dy = dropPosition.y - cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance < threshold && (!closest || distance < closest.distance)) {
			closest = { id: node.id, distance };
		}
	}

	return closest?.id ?? null;
}

export function wouldCreateCycle(
	personId: string,
	newManagerId: string,
	persons: Person[],
): boolean {
	const personMap = new Map(persons.map((p) => [p.id, p]));
	let current = newManagerId;
	const visited = new Set<string>();
	while (current) {
		if (current === personId) {
			return true;
		}
		if (visited.has(current)) {
			return false;
		}
		visited.add(current);
		const person = personMap.get(current);
		current = person?.managerId ?? "";
	}
	return false;
}
