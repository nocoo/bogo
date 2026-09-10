import type { CustomFieldDefinition, FieldType, UpdateFieldDefInput } from "@bogo/shared";
import { Button, Input, LayerCard } from "@nocoo/basalt";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FieldDefsVM } from "../../viewmodels/field/use-field-defs.js";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
	text: "Text",
	number: "Number",
	date: "Date",
	select: "Select",
	boolean: "Boolean",
};

export function FieldDefsManager({
	vm,
	showHeader = true,
	showCreateOverride,
	setShowCreateOverride,
}: {
	vm: FieldDefsVM;
	showHeader?: boolean;
	showCreateOverride?: boolean;
	setShowCreateOverride?: (open: boolean) => void;
}) {
	const [localShowCreate, setLocalShowCreate] = useState(false);
	const showCreate = showCreateOverride !== undefined ? showCreateOverride : localShowCreate;
	const setShowCreate =
		setShowCreateOverride !== undefined ? setShowCreateOverride : setLocalShowCreate;

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-5 w-5 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg bg-basalt-destructive/10 p-4 text-sm text-basalt-destructive">
				Failed to load field definitions: {vm.error.message}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{showHeader && (
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-basalt-foreground">Custom Fields</h3>
					<Button
						size="sm"
						onClick={() => setShowCreate(true)}
						disabled={showCreate}
						aria-label="Add field definition"
					>
						<Plus className="h-3 w-3" strokeWidth={2} />
						Add Field
					</Button>
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
		showOnChart: boolean;
	}) => void;
	onCancel: () => void;
	isCreating: boolean;
}) {
	const [name, setName] = useState("");
	const [fieldType, setFieldType] = useState<FieldType>("text");
	const [options, setOptions] = useState("");
	const [required, setRequired] = useState(false);
	const [showOnChart, setShowOnChart] = useState(false);

	const handleSubmit = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		const parsedOptions = options
			.split(",")
			.map((o) => o.trim())
			.filter(Boolean);
		if (fieldType === "select" && parsedOptions.length === 0) {
			return;
		}
		const input: {
			name: string;
			fieldType: FieldType;
			options?: string[];
			required: boolean;
			showOnChart: boolean;
		} = {
			name: trimmed,
			fieldType,
			required,
			showOnChart,
		};
		if (fieldType === "select") {
			input.options = parsedOptions;
		}
		onSubmit(input);
	}, [name, fieldType, options, required, showOnChart, onSubmit]);

	return (
		<LayerCard className="p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium text-basalt-foreground">New Field</span>
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
			<div className="grid grid-cols-2 gap-2">
				<div>
					<label htmlFor="field-name" className="text-xs text-basalt-muted-foreground">
						Name
					</label>
					<Input
						id="field-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Field name"
						className="mt-1 w-full"
						autoFocus={true}
					/>
				</div>
				<div>
					<label htmlFor="field-type" className="text-xs text-basalt-muted-foreground">
						Type
					</label>
					<select
						id="field-type"
						value={fieldType}
						onChange={(e) => setFieldType(e.target.value as FieldType)}
						className="field-select mt-1 w-full"
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
					<label htmlFor="field-options" className="text-xs text-basalt-muted-foreground">
						Options (comma-separated)
					</label>
					<Input
						id="field-options"
						type="text"
						value={options}
						onChange={(e) => setOptions(e.target.value)}
						placeholder="Option 1, Option 2, ..."
						className="mt-1 w-full"
					/>
				</div>
			)}
			<div className="flex items-center gap-4">
				<label className="flex items-center gap-2 text-xs text-basalt-muted-foreground">
					<input
						type="checkbox"
						checked={required}
						onChange={(e) => setRequired(e.target.checked)}
						className="rounded border-basalt-border"
					/>
					Required
				</label>
				<label className="flex items-center gap-2 text-xs text-basalt-muted-foreground">
					<input
						type="checkbox"
						checked={showOnChart}
						onChange={(e) => setShowOnChart(e.target.checked)}
						className="rounded border-basalt-border"
					/>
					Show on chart
				</label>
			</div>
			<div className="flex items-center gap-2">
				<Button
					onClick={handleSubmit}
					disabled={
						!name.trim() ||
						isCreating ||
						(fieldType === "select" && !options.split(",").some((o) => o.trim()))
					}
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
	onUpdate: (id: string, input: UpdateFieldDefInput) => void;
	onRemove: (id: string) => void;
	isRemoving: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(def.name);
	const [editOptions, setEditOptions] = useState(def.options?.join(", ") ?? "");

	useEffect(() => {
		setEditName(def.name);
	}, [def.name]);

	useEffect(() => {
		setEditOptions(def.options?.join(", ") ?? "");
	}, [def.options]);

	const handleSave = useCallback(() => {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== def.name) {
			onUpdate(def.id, { name: trimmed });
		}
		setEditing(false);
	}, [editName, def, onUpdate]);

	const handleTypeChange = useCallback(
		(newType: FieldType) => {
			onUpdate(def.id, { fieldType: newType });
		},
		[def.id, onUpdate],
	);

	const handleRequiredToggle = useCallback(() => {
		onUpdate(def.id, { required: !def.required });
	}, [def.id, def.required, onUpdate]);

	const handleShowOnChartToggle = useCallback(() => {
		onUpdate(def.id, { showOnChart: !def.showOnChart });
	}, [def.id, def.showOnChart, onUpdate]);

	const handleOptionsBlur = useCallback(() => {
		const parsed = editOptions
			.split(",")
			.map((o) => o.trim())
			.filter(Boolean);
		const current = def.options ?? [];
		if (JSON.stringify(parsed) !== JSON.stringify(current)) {
			onUpdate(def.id, { options: parsed });
		}
	}, [editOptions, def.id, def.options, onUpdate]);

	return (
		<LayerCard className="group px-3 py-2 space-y-1.5 bg-basalt-bright border border-basalt-border">
			<div className="flex items-center gap-2">
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
							className="w-full rounded border border-basalt-border bg-basalt-control px-2 py-1 text-sm text-basalt-foreground outline-none"
							// biome-ignore lint/a11y/noAutofocus: intentional focus on inline edit
							autoFocus={true}
							aria-label={`Edit name for ${def.name}`}
						/>
					) : (
						<span className="text-sm text-foreground truncate">{def.name}</span>
					)}
				</div>
				{!editing && (
					<button
						type="button"
						onClick={() => setEditing(true)}
						className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
						aria-label={`Edit ${def.name}`}
					>
						<Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
					</button>
				)}
				<button
					type="button"
					onClick={() => onRemove(def.id)}
					disabled={isRemoving}
					className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
					aria-label={`Delete ${def.name}`}
				>
					{isRemoving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" strokeWidth={1.5} />
					)}
				</button>
			</div>
			<div className="flex items-center gap-3 pl-6">
				<select
					value={def.fieldType}
					onChange={(e) => handleTypeChange(e.target.value as FieldType)}
					className="field-select field-sm"
					aria-label={`Type for ${def.name}`}
				>
					{Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
						<option key={k} value={k}>
							{v}
						</option>
					))}
				</select>
				<label className="flex items-center gap-1.5 text-xs text-basalt-muted-foreground">
					<input
						type="checkbox"
						checked={def.required}
						onChange={handleRequiredToggle}
						className="rounded border-basalt-border"
						aria-label={`Required for ${def.name}`}
					/>
					Required
				</label>
				<label className="flex items-center gap-1.5 text-xs text-basalt-muted-foreground">
					<input
						type="checkbox"
						checked={def.showOnChart}
						onChange={handleShowOnChartToggle}
						className="rounded border-basalt-border"
						aria-label={`Show on chart for ${def.name}`}
					/>
					Show on chart
				</label>
				{def.options && (
					<span className="text-xs text-basalt-muted-foreground">{def.options.length} options</span>
				)}
			</div>
			{def.fieldType === "select" && (
				<div className="pl-6">
					<input
						type="text"
						value={editOptions}
						onChange={(e) => setEditOptions(e.target.value)}
						onBlur={handleOptionsBlur}
						placeholder="Option 1, Option 2, ..."
						className="field field-sm w-full"
						aria-label={`Options for ${def.name}`}
					/>
				</div>
			)}
		</LayerCard>
	);
}
