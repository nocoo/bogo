import { useWorkspaceList } from "@/viewmodels/workspace/use-workspace-list.js";
import type { Workspace } from "@bogo/shared";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

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
		// biome-ignore lint/a11y/useKeyWithClickEvents: workspace item with nested interactive elements
		<div
			className={`group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors cursor-pointer ${
				isSelected ? "bg-primary/10 border border-primary/20" : "bg-secondary hover:bg-accent"
			}`}
			onClick={onSelect}
		>
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
				<Building2 className="h-4 w-4 text-primary" strokeWidth={1.5} />
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
						className="w-full bg-transparent border-b border-primary text-sm text-foreground outline-none py-0.5"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on edit activation
						autoFocus={true}
					/>
				) : (
					<>
						<p className="text-sm font-medium text-foreground truncate">{workspace.name}</p>
						<p className="text-xs text-muted-foreground">
							{new Date(workspace.createdAt).toLocaleDateString()}
						</p>
					</>
				)}
			</div>

			{!editing && (
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setEditName(workspace.name);
							setEditing(true);
						}}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
						aria-label={`Rename ${workspace.name}`}
					>
						<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-background transition-colors"
						aria-label={`Delete ${workspace.name}`}
					>
						<Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
					</button>
				</div>
			)}
		</div>
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
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-xl bg-red-500/10 p-6 text-center">
				<p className="text-sm text-red-500">Failed to load workspaces</p>
				<p className="mt-1 text-xs text-muted-foreground">{vm.error.message}</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-lg font-semibold text-foreground">Workspaces</h2>
					<p className="text-sm text-muted-foreground">Manage your organization workspaces</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Plus className="h-4 w-4" strokeWidth={1.5} />
					New
				</button>
			</div>

			{showCreate && (
				<div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
					<input
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
						className="flex-1 bg-transparent border-b border-border text-sm text-foreground outline-none py-1 placeholder:text-muted-foreground focus:border-primary"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on form activation
						autoFocus={true}
					/>
					<button
						type="button"
						onClick={handleCreate}
						disabled={!newName.trim() || vm.isCreating}
						className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					>
						{vm.isCreating ? "Creating..." : "Create"}
					</button>
					<button
						type="button"
						onClick={() => {
							setShowCreate(false);
							setNewName("");
						}}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</button>
				</div>
			)}

			{vm.mutationError && (
				<div className="rounded-lg bg-red-500/10 px-4 py-2">
					<p className="text-xs text-red-500">{vm.mutationError.message}</p>
				</div>
			)}

			{vm.workspaces.length === 0 ? (
				<div className="rounded-xl bg-secondary p-12 text-center">
					<Building2 className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
					<p className="mt-3 text-sm text-muted-foreground">No workspaces yet</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Create your first workspace to get started
					</p>
				</div>
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
