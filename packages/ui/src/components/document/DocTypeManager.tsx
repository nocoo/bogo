import type { DocumentType } from "@bogo/shared";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DocTypesVM } from "../../viewmodels/document/use-doc-types.js";

const PRESET_COLORS = [
	"#3b82f6",
	"#ef4444",
	"#10b981",
	"#f59e0b",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#84cc16",
];

export function DocTypeManager({ vm }: { vm: DocTypesVM }) {
	const [showCreate, setShowCreate] = useState(false);

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
				Failed to load document types: {vm.error.message}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">Document Types</h3>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					disabled={showCreate}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					aria-label="Add document type"
				>
					<Plus className="h-3 w-3" strokeWidth={2} />
					Add Type
				</button>
			</div>

			{vm.mutationError && (
				<div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span className="flex-1">{vm.mutationError.message}</span>
					<button
						type="button"
						onClick={vm.clearMutationError}
						className="shrink-0 text-red-400 hover:text-red-300"
						aria-label="Dismiss error"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			{showCreate && (
				<CreateDocTypeForm
					onSubmit={(input) => {
						vm.create(input);
						setShowCreate(false);
					}}
					onCancel={() => setShowCreate(false)}
					isCreating={vm.isCreating}
				/>
			)}

			{vm.types.length === 0 && !showCreate && (
				<p className="py-4 text-center text-sm text-muted-foreground">
					No document types defined yet
				</p>
			)}

			<div className="space-y-2">
				{vm.types.map((dt, idx) => (
					<DocTypeRow
						key={dt.id}
						docType={dt}
						isFirst={idx === 0}
						isLast={idx === vm.types.length - 1}
						onMoveUp={() => {
							if (idx > 0) {
								const prev = vm.types[idx - 1];
								vm.reorder(dt.id, prev.sortOrder);
								vm.reorder(prev.id, dt.sortOrder);
							}
						}}
						onMoveDown={() => {
							if (idx < vm.types.length - 1) {
								const next = vm.types[idx + 1];
								vm.reorder(dt.id, next.sortOrder);
								vm.reorder(next.id, dt.sortOrder);
							}
						}}
						onUpdate={vm.update}
						onRemove={vm.remove}
						isRemoving={vm.isRemoving}
					/>
				))}
			</div>
		</div>
	);
}

function CreateDocTypeForm({
	onSubmit,
	onCancel,
	isCreating,
}: {
	onSubmit: (input: { name: string; color?: string | null }) => void;
	onCancel: () => void;
	isCreating: boolean;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<string>(PRESET_COLORS[0]);

	const handleSubmit = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		onSubmit({ name: trimmed, color });
	}, [name, color, onSubmit]);

	return (
		<div className="rounded-lg border border-border bg-card p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-foreground">New Document Type</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground hover:text-foreground"
					aria-label="Cancel create"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div>
				<label htmlFor="doctype-name" className="text-xs text-muted-foreground">
					Name
				</label>
				<input
					id="doctype-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Type name"
					className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
					// biome-ignore lint/a11y/noAutofocus: intentional focus on form open
					autoFocus={true}
				/>
			</div>
			<div>
				<span className="text-xs text-muted-foreground">Color</span>
				<div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Color selection">
					{PRESET_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setColor(c)}
							className={`h-6 w-6 rounded-full border-2 transition-all ${
								color === c ? "border-foreground scale-110" : "border-transparent"
							}`}
							style={{ backgroundColor: c }}
							aria-label={`Color ${c}`}
							aria-checked={color === c}
							role="radio"
						/>
					))}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!name.trim() || isCreating}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
				>
					{isCreating ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						<Plus className="h-3 w-3" strokeWidth={2} />
					)}
					{isCreating ? "Creating..." : "Create"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

function DocTypeRow({
	docType,
	isFirst,
	isLast,
	onMoveUp,
	onMoveDown,
	onUpdate,
	onRemove,
	isRemoving,
}: {
	docType: DocumentType;
	isFirst: boolean;
	isLast: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onUpdate: (id: string, input: { name?: string; color?: string | null }) => void;
	onRemove: (id: string) => void;
	isRemoving: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(docType.name);

	useEffect(() => {
		setEditName(docType.name);
	}, [docType.name]);

	const handleSave = useCallback(() => {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== docType.name) {
			onUpdate(docType.id, { name: trimmed });
		}
		setEditing(false);
	}, [editName, docType, onUpdate]);

	return (
		<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
			<div className="flex flex-col">
				<button
					type="button"
					onClick={onMoveUp}
					disabled={isFirst}
					className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${docType.name} up`}
				>
					<ChevronUp className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={onMoveDown}
					disabled={isLast}
					className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${docType.name} down`}
				>
					<ChevronDown className="h-3 w-3" />
				</button>
			</div>
			{docType.color && (
				<span
					className="h-4 w-4 shrink-0 rounded-full"
					style={{ backgroundColor: docType.color }}
					aria-label={`Color ${docType.color}`}
				/>
			)}
			<div className="flex-1 min-w-0">
				{editing ? (
					<input
						type="text"
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
						onBlur={handleSave}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleSave();
							}
							if (e.key === "Escape") {
								setEditName(docType.name);
								setEditing(false);
							}
						}}
						className="w-full rounded border border-primary bg-background px-2 py-0.5 text-sm text-foreground outline-none"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on inline edit
						autoFocus={true}
						aria-label={`Edit name for ${docType.name}`}
					/>
				) : (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="text-sm text-foreground hover:text-primary truncate text-left"
						aria-label={`Edit ${docType.name}`}
					>
						{docType.name}
					</button>
				)}
			</div>
			<button
				type="button"
				onClick={() => onRemove(docType.id)}
				disabled={isRemoving}
				className="shrink-0 text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors"
				aria-label={`Delete ${docType.name}`}
			>
				{isRemoving ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Trash2 className="h-4 w-4" strokeWidth={1.5} />
				)}
			</button>
		</div>
	);
}
