import type { Person } from "@bogo/shared";
import { useCallback, useMemo, useState } from "react";
import {
	type PersonEdge,
	type PersonNode,
	computeTreeLayout,
	findDropTarget,
	wouldCreateCycle,
} from "./person-tree-layout.js";
import { usePersonList } from "./use-person-list.js";

export interface PersonTreeVM {
	nodes: PersonNode[];
	edges: PersonEdge[];
	persons: Person[];
	isLoading: boolean;
	error: Error | null;

	selectedPersonId: string | null;
	selectPerson: (id: string | null) => void;

	handleDrop: (draggedId: string, dropPosition: { x: number; y: number }) => void;
	dropError: string | null;
	clearDropError: () => void;

	create: (name: string, managerId: string | null) => void;
	update: (id: string, fields: { name?: string; title?: string }) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isMoving: boolean;
	isRemoving: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function usePersonTree(): PersonTreeVM {
	const vm = usePersonList();
	const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
	const [dropError, setDropError] = useState<string | null>(null);

	const { nodes, edges } = useMemo(() => computeTreeLayout(vm.persons), [vm.persons]);

	const handleDrop = useCallback(
		(draggedId: string, dropPosition: { x: number; y: number }) => {
			setDropError(null);

			const person = vm.persons.find((p) => p.id === draggedId);
			if (!person) {
				return;
			}
			if (person.isRoot) {
				setDropError("Cannot move the root node");
				return;
			}

			const targetId = findDropTarget(draggedId, dropPosition, nodes);
			if (!targetId) {
				return;
			}
			if (targetId === person.managerId) {
				return;
			}

			if (wouldCreateCycle(draggedId, targetId, vm.persons)) {
				setDropError("Cannot move: would create a cycle");
				return;
			}

			vm.move(draggedId, targetId);
		},
		[vm, nodes],
	);

	const selectPerson = useCallback((id: string | null) => setSelectedPersonId(id), []);
	const clearDropError = useCallback(() => setDropError(null), []);

	return {
		nodes,
		edges,
		persons: vm.persons,
		isLoading: vm.isLoading,
		error: vm.error,
		selectedPersonId,
		selectPerson,
		handleDrop,
		dropError,
		clearDropError,
		create: vm.create,
		update: vm.update,
		remove: vm.remove,
		isCreating: vm.isCreating,
		isMoving: vm.isMoving,
		isRemoving: vm.isRemoving,
		mutationError: vm.mutationError,
		clearMutationError: vm.clearMutationError,
	};
}
