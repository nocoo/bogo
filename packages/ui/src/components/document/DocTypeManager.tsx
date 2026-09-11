import type { DocumentType } from "@bogo/shared";
import {
	Button,
	Input,
	LayerCard,
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTrigger,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
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
				<Loader2 className="h-5 w-5 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg bg-basalt-destructive/10 p-4 text-sm text-basalt-danger">
				Failed to load document types: {vm.error.message}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<PageHeader
				title="Document Types"
				description="Classify documents with reusable types and colors."
				actions={
					<Button
						onClick={() => setShowCreate(true)}
						disabled={showCreate}
						aria-label="Add document type"
					>
						<Plus className="h-4 w-4" strokeWidth={1.5} />
						Add Type
					</Button>
				}
			/>
			<LayerCard className="space-y-4">
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
					<p className="py-4 text-center text-sm text-basalt-muted-foreground">
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
			</LayerCard>
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
		<LayerCard className="p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-basalt-foreground">New Document Type</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onCancel}
					className="h-6 w-6 text-basalt-muted-foreground hover:text-basalt-foreground"
					aria-label="Cancel create"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div>
				<label htmlFor="doctype-name" className="text-xs text-basalt-muted-foreground">
					Name
				</label>
				<Input
					id="doctype-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Type name"
					className="mt-1 w-full"
					autoFocus={true}
				/>
			</div>
			<div>
				<span className="text-xs text-basalt-muted-foreground">Color</span>
				<div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Color selection">
					{PRESET_COLORS.map((c) => (
						// biome-ignore lint/a11y/useSemanticElements: custom color radio
						<button
							key={c}
							type="button"
							onClick={() => setColor(c)}
							className={`h-6 w-6 rounded-full border-2 transition-all ${
								color === c ? "border-basalt-foreground scale-110" : "border-transparent"
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
				<Button
					onClick={handleSubmit}
					disabled={!name.trim() || isCreating}
					loading={isCreating}
					size="sm"
				>
					<Plus className="h-3 w-3" strokeWidth={2} />
					{isCreating ? "Creating..." : "Create"}
				</Button>
				<Button variant="ghost" size="sm" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</LayerCard>
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
		<LayerCard className="group flex items-center gap-2 px-3 py-2 ">
			<div className="flex flex-col">
				<button
					type="button"
					onClick={onMoveUp}
					disabled={isFirst}
					className="text-basalt-muted-foreground hover:text-basalt-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${docType.name} up`}
				>
					<ChevronUp className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={onMoveDown}
					disabled={isLast}
					className="text-basalt-muted-foreground hover:text-basalt-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${docType.name} down`}
				>
					<ChevronDown className="h-3 w-3" />
				</button>
			</div>
			<Popover>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="h-4 w-4 shrink-0 rounded-full border border-basalt-border hover:scale-125 transition-transform"
						style={{ backgroundColor: docType.color ?? "#6b7280" }}
						aria-label={`Change color for ${docType.name}`}
					/>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="grid grid-cols-4 gap-2 p-3"
					aria-label={`Color for ${docType.name}`}
				>
					{PRESET_COLORS.map((c) => (
						<PopoverClose key={c} asChild>
							<button
								type="button"
								onClick={() => onUpdate(docType.id, { color: c })}
								className={`h-6 w-6 rounded-full border-2 transition-all ${
									docType.color === c ? "border-basalt-foreground scale-110" : "border-transparent"
								}`}
								style={{ backgroundColor: c }}
								aria-label={`Select color ${c}`}
								aria-pressed={docType.color === c}
							/>
						</PopoverClose>
					))}
				</PopoverContent>
			</Popover>
			<div className="flex-1 min-w-0">
				{editing ? (
					<Input
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
						className="w-full rounded border border-basalt-border bg-basalt-control px-2 py-0.5 text-sm text-basalt-foreground outline-none"
						autoFocus={true}
						aria-label={`Edit name for ${docType.name}`}
					/>
				) : (
					<span className="text-sm text-basalt-foreground truncate">{docType.name}</span>
				)}
			</div>
			{!editing && (
				<button
					type="button"
					onClick={() => setEditing(true)}
					className="shrink-0 text-basalt-muted-foreground hover:text-basalt-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
					aria-label={`Edit ${docType.name}`}
				>
					<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
				</button>
			)}
			<button
				type="button"
				onClick={() => onRemove(docType.id)}
				disabled={isRemoving}
				className="shrink-0 text-basalt-muted-foreground hover:text-basalt-danger disabled:opacity-50 transition-colors"
				aria-label={`Delete ${docType.name}`}
			>
				{isRemoving ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Trash2 className="h-4 w-4" strokeWidth={1.5} />
				)}
			</button>
		</LayerCard>
	);
}
