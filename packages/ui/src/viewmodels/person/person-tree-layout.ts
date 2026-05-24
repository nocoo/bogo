import type { Person } from "@bogo/shared";
import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;

export interface PersonNodeData extends Record<string, unknown> {
	person: Person;
}

export type PersonNode = Node<PersonNodeData, "person">;
export type PersonEdge = Edge;

export function computeTreeLayout(persons: Person[]): {
	nodes: PersonNode[];
	edges: PersonEdge[];
} {
	if (persons.length === 0) {
		return { nodes: [], edges: [] };
	}

	const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });

	for (const p of persons) {
		g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	}
	for (const p of persons) {
		if (p.managerId) {
			g.setEdge(p.managerId, p.id);
		}
	}

	Dagre.layout(g);

	const nodes: PersonNode[] = persons.map((p) => {
		const pos = g.node(p.id);
		return {
			id: p.id,
			position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
			data: { person: p },
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
				style: { strokeDasharray: "5 5" },
				animated: true,
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
		const cy = node.position.y + NODE_HEIGHT / 2;
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
