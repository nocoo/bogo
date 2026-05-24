import type { CustomFieldDefinition, FieldType } from "@bogo/shared";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import type { FieldDefsVM } from "../../viewmodels/field/use-field-defs.js";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
	text: "Text",
	number: "Number",
	date: "Date",
	select: "Select",
	boolean: "Boolean",
};

export function FieldDefsManager({ vm }: { vm: FieldDefsVM }) {
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
				Failed to load field definitions: {vm.error.message}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">Custom Fields</h3>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					disabled={showCreate}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					aria-label="Add field definition"
				>
					<Plus className="h-3 w-3" strokeWidth={2} />
					Add Field
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
				<CreateFieldForm
					onSubmit={(input) => {
						vm.create(input);
						setShowCreate(false);
					}}
					onCancel={() => setShowCreate(false)}
					isCreating={vm.isCreating}
				/>
			)}

			{vm.defs.length === 0 && !showCreate && (
				<p className="py-4 text-center text-sm text-muted-foreground">
					No custom fields defined yet
				</p>
			)}

			<div className="space-y-2">
				{vm.defs.map((def, idx) => (
					<FieldDefRow
						key={def.id}
						def={def}
						isFirst={idx === 0}
						isLast={idx === vm.defs.length - 1}
						onMoveUp={() => {
							if (idx > 0) {
								const prev = vm.defs[idx - 1];
								vm.reorder(def.id, prev.sortOrder);
								vm.reorder(prev.id, def.sortOrder);
							}
						}}
						onMoveDown={() => {
							if (idx < vm.defs.length - 1) {
								const next = vm.defs[idx + 1];
								vm.reorder(def.id, next.sortOrder);
								vm.reorder(next.id, def.sortOrder);
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

function CreateFieldForm({
	onSubmit,
	onCancel,
	isCreating,
}: {
	onSubmit: (input: {
		name: string;
		fieldType: FieldType;
		options?: string[];
		required: boolean;
	}) => void;
	onCancel: () => void;
	isCreating: boolean;
}) {
	const [name, setName] = useState("");
	const [fieldType, setFieldType] = useState<FieldType>("text");
	const [options, setOptions] = useState("");
	const [required, setRequired] = useState(false);

	const handleSubmit = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		const input: { name: string; fieldType: FieldType; options?: string[]; required: boolean } = {
			name: trimmed,
			fieldType,
			required,
		};
		if (fieldType === "select" && options.trim()) {
			input.options = options
				.split(",")
				.map((o) => o.trim())
				.filter(Boolean);
		}
		onSubmit(input);
	}, [name, fieldType, options, required, onSubmit]);

	return (
		<div className="rounded-lg border border-border bg-card p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-foreground">New Field</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground hover:text-foreground"
					aria-label="Cancel create"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<div>
					<label htmlFor="field-name" className="text-xs text-muted-foreground">
						Name
					</label>
					<input
						id="field-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Field name"
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on form open
						autoFocus={true}
					/>
				</div>
				<div>
					<label htmlFor="field-type" className="text-xs text-muted-foreground">
						Type
					</label>
					<select
						id="field-type"
						value={fieldType}
						onChange={(e) => setFieldType(e.target.value as FieldType)}
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
					>
						{Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
							<option key={k} value={k}>
								{v}
							</option>
						))}
					</select>
				</div>
			</div>
			{fieldType === "select" && (
				<div>
					<label htmlFor="field-options" className="text-xs text-muted-foreground">
						Options (comma-separated)
					</label>
					<input
						id="field-options"
						type="text"
						value={options}
						onChange={(e) => setOptions(e.target.value)}
						placeholder="Option 1, Option 2, ..."
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
					/>
				</div>
			)}
			<div className="flex items-center gap-4">
				<label className="flex items-center gap-2 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={required}
						onChange={(e) => setRequired(e.target.checked)}
						className="rounded border-border"
					/>
					Required
				</label>
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

function FieldDefRow({
	def,
	isFirst,
	isLast,
	onMoveUp,
	onMoveDown,
	onUpdate,
	onRemove,
	isRemoving,
}: {
	def: CustomFieldDefinition;
	isFirst: boolean;
	isLast: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onUpdate: (id: string, input: { name?: string; required?: boolean }) => void;
	onRemove: (id: string) => void;
	isRemoving: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(def.name);

	const handleSave = useCallback(() => {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== def.name) {
			onUpdate(def.id, { name: trimmed });
		}
		setEditing(false);
	}, [editName, def, onUpdate]);

	return (
		<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
			<div className="flex flex-col">
				<button
					type="button"
					onClick={onMoveUp}
					disabled={isFirst}
					className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${def.name} up`}
				>
					<ChevronUp className="h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={onMoveDown}
					disabled={isLast}
					className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
					aria-label={`Move ${def.name} down`}
				>
					<ChevronDown className="h-3 w-3" />
				</button>
			</div>
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
								setEditName(def.name);
								setEditing(false);
							}
						}}
						className="w-full rounded border border-primary bg-background px-2 py-0.5 text-sm text-foreground outline-none"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on inline edit
						autoFocus={true}
						aria-label={`Edit name for ${def.name}`}
					/>
				) : (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="text-sm text-foreground hover:text-primary truncate text-left"
						aria-label={`Edit ${def.name}`}
					>
						{def.name}
					</button>
				)}
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>{FIELD_TYPE_LABELS[def.fieldType]}</span>
					{def.required && <span className="text-amber-500">Required</span>}
					{def.options && <span>{def.options.length} options</span>}
				</div>
			</div>
			<button
				type="button"
				onClick={() => onRemove(def.id)}
				disabled={isRemoving}
				className="shrink-0 text-muted-foreground hover:text-red-500 disabled:opacity-50 transition-colors"
				aria-label={`Delete ${def.name}`}
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
