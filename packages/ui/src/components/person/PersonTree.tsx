import { useQuery } from "@tanstack/react-query";
import {
	Background,
	BackgroundVariant,
	Controls,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
} from "@xyflow/react";
import { useWorkspaceContext } from "@/contexts/workspace-context.js";
import { personModel } from "@/models/person.model.js";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs.js";
import { useAllFieldValues, useFieldValues } from "@/viewmodels/field/use-field-values.js";
import type { ChartFieldRow } from "@/viewmodels/person/person-tree-layout.js";
import { usePersonTree } from "@/viewmodels/person/use-person-tree.js";
import "@xyflow/react/dist/style.css";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { CreatePersonDialog, EmptyPersonState } from "./CreatePersonDialog.js";
import { EditPersonPanel } from "./EditPersonPanel.js";
import { PersonDocTimeline } from "./PersonDocTimeline.js";
import { PersonNode } from "./PersonNode.js";

const nodeTypes = { person: PersonNode };

export function getNodeCenter(nodeId: string): { x: number; y: number } | null {
	const el = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement | null;
	if (!el) {
		return null;
	}
	const rect = el.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function PersonTreeInner() {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const fieldDefsVm = useFieldDefs();
	const chartDefs = useMemo(
		// The list endpoint already returns defs ordered by sortOrder, but
		// optimistic post-create cache updates can prepend a fresh def with
		// sortOrder=0 in front of existing rows, so re-sort explicitly to
		// keep chart rows stable regardless of cache mutations. Stable
		// numeric sort — no in-place mutation of the vm array.
		() =>
			fieldDefsVm.defs
				.filter((d) => d.showOnChart)
				.slice()
				.sort((a, b) => a.sortOrder - b.sortOrder),
		[fieldDefsVm.defs],
	);
	// Skip the bulk fetch when no field is opted-in — avoids a wasted
	// GET on every workspace where showOnChart hasn't been enabled.
	const allValuesVm = useAllFieldValues(chartDefs.length > 0);

	// Peek at the person list from the same query cache that usePersonTree
	// consumes below. Reading it here lets us build one row per person even
	// when they have zero saved values yet — without this, a person with no
	// custom_field_values rows would fall out of the map and the em-dash
	// placeholder wouldn't render, so the tree would jump vertically the
	// first time each person gets their first value saved.
	const personListQuery = useQuery(personModel.listQueryOptions(wid));
	const persons = personListQuery.data;

	const chartFieldsByPerson = useMemo(() => {
		if (chartDefs.length === 0 || !persons) {
			return undefined;
		}
		const result = new Map<string, ChartFieldRow[]>();
		for (const p of persons) {
			const values = allValuesVm.valuesByPerson.get(p.id) ?? [];
			const valueByDef = new Map(values.map((v) => [v.fieldDefId, v.value]));
			const rows: ChartFieldRow[] = chartDefs.map((d) => ({
				fieldDefId: d.id,
				name: d.name,
				value: valueByDef.get(d.id) ?? "",
			}));
			result.set(p.id, rows);
		}
		return result;
	}, [chartDefs, persons, allValuesVm.valuesByPerson]);

	const vm = usePersonTree(chartFieldsByPerson);
	const { screenToFlowPosition } = useReactFlow();
	const [showCreate, setShowCreate] = useState(false);
	const fieldValuesVm = useFieldValues(vm.selectedPersonId ?? "");

	const handleNodeClick = useCallback(
		(_: React.MouseEvent, node: { id: string }) => {
			vm.selectPerson(node.id);
		},
		[vm],
	);

	const handlePaneClick = useCallback(() => {
		vm.selectPerson(null);
	}, [vm]);

	const handleNodeDragStop = useCallback(
		(_: MouseEvent | TouchEvent, node: { id: string }, _nodes: unknown[]) => {
			const screenCenter = getNodeCenter(node.id);
			if (!screenCenter) {
				return;
			}
			const flowPos = screenToFlowPosition(screenCenter);
			vm.handleDrop(node.id, flowPos);
		},
		[vm, screenToFlowPosition],
	);

	const handleCreate = useCallback(
		(name: string, managerId: string) => {
			vm.create(name, managerId);
			setShowCreate(false);
		},
		[vm],
	);

	const selectedPerson = useMemo(
		() => vm.persons.find((p) => p.id === vm.selectedPersonId) ?? null,
		[vm.persons, vm.selectedPersonId],
	);

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center h-full min-h-[400px]">
				<p className="text-sm text-muted-foreground">Select a workspace first</p>
			</div>
		);
	}

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center h-full min-h-[400px]">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
				<AlertCircle className="h-8 w-8 text-destructive" strokeWidth={1.5} />
				<p className="mt-2 text-sm text-destructive">Failed to load people</p>
				<p className="mt-1 text-xs text-muted-foreground">{vm.error.message}</p>
			</div>
		);
	}

	if (vm.persons.length === 0) {
		return <EmptyPersonState />;
	}

	return (
		<div className="relative h-full min-h-[500px]">
			<ReactFlow
				nodes={vm.nodes}
				edges={vm.edges}
				nodeTypes={nodeTypes}
				onNodeClick={handleNodeClick}
				onPaneClick={handlePaneClick}
				onNodeDragStop={handleNodeDragStop}
				fitView={true}
				nodesDraggable={true}
				nodesConnectable={false}
				proOptions={{ hideAttribution: true }}
			>
				<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
				<Controls showInteractive={false} />
			</ReactFlow>

			<div className="absolute top-3 left-3 z-10">
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
					aria-label="Add person"
				>
					<Plus className="h-4 w-4" strokeWidth={1.5} />
					Add
				</button>
			</div>

			{showCreate && (
				<div className="absolute top-14 left-3 z-10">
					<CreatePersonDialog
						persons={vm.persons}
						onSubmit={handleCreate}
						onClose={() => setShowCreate(false)}
						isCreating={vm.isCreating}
					/>
				</div>
			)}

			{selectedPerson && (
				<>
					<div className="absolute top-3 right-[304px] z-10">
						<PersonDocTimeline personId={selectedPerson.id} onClose={() => vm.selectPerson(null)} />
					</div>
					<div className="absolute top-3 right-3 z-10">
						<EditPersonPanel
							person={selectedPerson}
							persons={vm.persons}
							onUpdate={vm.update}
							onMove={vm.move}
							onRemove={vm.remove}
							onClose={() => vm.selectPerson(null)}
							isRemoving={vm.isRemoving}
							fieldDefs={fieldDefsVm.defs}
							fieldValuesVm={fieldValuesVm}
						/>
					</div>
				</>
			)}

			{vm.dropError && (
				<div className="absolute bottom-3 left-3 right-3 z-10">
					<div className="rounded-lg bg-destructive/10 px-4 py-2 flex items-center justify-between">
						<p className="text-xs text-destructive">{vm.dropError}</p>
						<button
							type="button"
							onClick={() => {
								vm.clearDropError();
							}}
							className="text-destructive hover:text-destructive/80 ml-2"
							aria-label="Dismiss error"
						>
							<AlertCircle className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export function PersonTree() {
	return (
		<ReactFlowProvider>
			<PersonTreeInner />
		</ReactFlowProvider>
	);
}
