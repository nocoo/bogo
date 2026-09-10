import type { Workspace } from "@bogo/shared";
import { Button, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useWorkspaceList } from "@/viewmodels/workspace/use-workspace-list.js";

function WorkspaceItem({
	workspace,
	isSelected,
	onSelect,
	onRename,
	onDelete,
}: {
	workspace: Workspace;
	isSelected: boolean;
	onSelect: () => void;
	onRename: (name: string) => void;
	onDelete: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(workspace.name);

	const handleSubmit = () => {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== workspace.name) {
			onRename(trimmed);
		}
		setEditing(false);
	};

	return (
		<LayerCard
			className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
				isSelected
					? "bg-basalt-primary/10 border border-basalt-primary/20"
					: "hover:bg-basalt-accent"
			}`}
			onClick={onSelect}
		>
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-basalt-primary/10">
				<Building2 className="h-4 w-4 text-basalt-primary" strokeWidth={1.5} />
			</div>

			<div className="flex-1 min-w-0">
				{editing ? (
					<input
						type="text"
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
						onBlur={handleSubmit}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleSubmit();
							}
							if (e.key === "Escape") {
								setEditName(workspace.name);
								setEditing(false);
							}
						}}
						onClick={(e) => e.stopPropagation()}
						className="w-full bg-transparent border-b border-basalt-primary text-sm text-basalt-foreground outline-none py-0.5"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on edit activation
						autoFocus={true}
					/>
				) : (
					<>
						<p className="text-sm font-medium text-basalt-foreground truncate">{workspace.name}</p>
						<p className="text-xs text-basalt-muted-foreground">
							{new Date(workspace.createdAt).toLocaleDateString()}
						</p>
					</>
				)}
			</div>

			{!editing && (
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						onClick={(e) => {
							e.stopPropagation();
							setEditName(workspace.name);
							setEditing(true);
						}}
						className="h-7 w-7 text-basalt-muted-foreground hover:text-basalt-foreground"
						aria-label={`Rename ${workspace.name}`}
					>
						<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						className="h-7 w-7 text-basalt-muted-foreground hover:text-basalt-destructive"
						aria-label={`Delete ${workspace.name}`}
					>
						<Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
					</Button>
				</div>
			)}
		</LayerCard>
	);
}

export function WorkspaceList() {
	const vm = useWorkspaceList();
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");

	const handleCreate = useCallback(() => {
		const trimmed = newName.trim();
		if (trimmed) {
			vm.create(trimmed);
			setNewName("");
			setShowCreate(false);
		}
	}, [newName, vm]);

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-xl bg-basalt-destructive/10 p-6 text-center">
				<p className="text-sm text-basalt-destructive">Failed to load workspaces</p>
				<p className="mt-1 text-xs text-basalt-muted-foreground">{vm.error.message}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				title="Workspaces"
				description="Manage your organization workspaces and access scopes."
				actions={
					<Button onClick={() => setShowCreate(true)} aria-label="New workspace">
						<Plus className="h-4 w-4" strokeWidth={1.5} />
						New
					</Button>
				}
			/>

			{showCreate && (
				<LayerCard className="flex items-center gap-2 p-3">
					<Input
						type="text"
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleCreate();
							}
							if (e.key === "Escape") {
								setShowCreate(false);
								setNewName("");
							}
						}}
						placeholder="Workspace name"
						className="flex-1"
						autoFocus={true}
					/>
					<Button
						size="sm"
						onClick={handleCreate}
						disabled={!newName.trim() || vm.isCreating}
						loading={vm.isCreating}
					>
						{vm.isCreating ? "Creating..." : "Create"}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setShowCreate(false);
							setNewName("");
						}}
					>
						Cancel
					</Button>
				</LayerCard>
			)}

			{vm.workspaces.length === 0 ? (
				<LayerCard className="p-12 text-center">
					<Building2 className="mx-auto h-10 w-10 text-basalt-muted-foreground" strokeWidth={1} />
					<p className="mt-3 text-sm text-basalt-muted-foreground">No workspaces yet</p>
					<p className="mt-1 text-xs text-basalt-muted-foreground">
						Create your first workspace to get started
					</p>
				</LayerCard>
			) : (
				<div className="space-y-2">
					{vm.workspaces.map((ws) => (
						<WorkspaceItem
							key={ws.id}
							workspace={ws}
							isSelected={vm.selectedId === ws.id}
							onSelect={() => vm.select(ws.id)}
							onRename={(name) => vm.rename(ws.id, name)}
							onDelete={() => vm.remove(ws.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
