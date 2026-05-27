import type { TagScope } from "@bogo/shared";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { TagBadge } from "../components/TagBadge.js";
import { PRESET_HEX_VALUES } from "../lib/tag-colors.js";
import { useTags } from "../viewmodels/tag/use-tags.js";

export function TagsSettingsPage() {
	const [scope, setScope] = useState<TagScope>("document");

	return (
		<div className="rounded-xl bg-secondary p-5">
			<div className="flex items-center justify-between mb-4">
				<h2 className="font-semibold text-foreground text-lg">Tags</h2>
			</div>

			<div className="flex gap-1 mb-4 border-b border-border" role="tablist">
				<button
					type="button"
					role="tab"
					aria-label="Document Tags"
					aria-selected={scope === "document"}
					onClick={() => setScope("document")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						scope === "document"
							? "border-primary text-primary"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Document Tags
				</button>
				<button
					type="button"
					role="tab"
					aria-label="Person Tags"
					aria-selected={scope === "person"}
					onClick={() => setScope("person")}
					className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
						scope === "person"
							? "border-primary text-primary"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					Person Tags
				</button>
			</div>

			<TagList scope={scope} />
		</div>
	);
}

function TagList({ scope }: { scope: TagScope }) {
	const vm = useTags(scope);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{vm.tags.length === 0 && !creating && (
				<p className="text-sm text-muted-foreground py-4 text-center">
					No tags defined for this scope yet.
				</p>
			)}

			{vm.tags.map((tag) =>
				editingId === tag.id ? (
					<EditRow
						key={tag.id}
						name={tag.name}
						color={tag.color}
						onSave={(name, color) => {
							vm.update(tag.id, { name, color });
							setEditingId(null);
						}}
						onCancel={() => setEditingId(null)}
					/>
				) : deletingId === tag.id ? (
					<div
						key={tag.id}
						className="flex items-center gap-3 py-2 px-3 rounded-md bg-red-500/5 border border-red-500/20"
					>
						<span className="text-sm text-foreground flex-1">Delete &quot;{tag.name}&quot;?</span>
						<button
							type="button"
							onClick={() => {
								vm.remove(tag.id);
								setDeletingId(null);
							}}
							className="text-xs font-medium text-red-400 hover:text-red-300"
						>
							Confirm
						</button>
						<button
							type="button"
							onClick={() => setDeletingId(null)}
							className="text-xs font-medium text-muted-foreground hover:text-foreground"
						>
							Cancel
						</button>
					</div>
				) : (
					<div
						key={tag.id}
						className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-accent/50 transition-colors"
					>
						<TagBadge name={tag.name} color={tag.color} />
						<span className="text-xs text-muted-foreground ml-auto">{tag.assignedCount}</span>
						<button
							type="button"
							onClick={() => setEditingId(tag.id)}
							className="text-muted-foreground hover:text-foreground transition-colors"
							aria-label={`Edit ${tag.name}`}
						>
							<Pencil className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							onClick={() => setDeletingId(tag.id)}
							className="text-muted-foreground hover:text-red-400 transition-colors"
							aria-label={`Delete ${tag.name}`}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					</div>
				),
			)}

			{creating ? (
				<CreateRow
					scope={scope}
					onCreate={(name, color) => {
						vm.create({ name, scope, color });
						setCreating(false);
					}}
					onCancel={() => setCreating(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setCreating(true)}
					className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
					aria-label="Create tag"
				>
					<Plus className="h-4 w-4" />
					Add tag
				</button>
			)}
		</div>
	);
}

function CreateRow({
	scope,
	onCreate,
	onCancel,
}: {
	scope: TagScope;
	onCreate: (name: string, color: string | null) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<string | null>(null);

	const handleSubmit = useCallback(() => {
		if (!name.trim()) {
			return;
		}
		onCreate(name.trim(), color);
	}, [name, color, onCreate]);

	return (
		<div className="flex items-center gap-3 py-2 px-3 rounded-md border border-border bg-background">
			<ColorPicker value={color} onChange={setColor} />
			<input
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder={`New ${scope} tag name…`}
				className="flex-1 bg-transparent text-sm text-foreground outline-none"
				aria-label="Tag name"
				ref={(el) => el?.focus()}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						handleSubmit();
					}
					if (e.key === "Escape") {
						onCancel();
					}
				}}
			/>
			<button
				type="button"
				onClick={handleSubmit}
				disabled={!name.trim()}
				className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
			>
				Create
			</button>
			<button
				type="button"
				onClick={onCancel}
				className="text-muted-foreground hover:text-foreground transition-colors"
				aria-label="Cancel create"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}

function EditRow({
	name: initialName,
	color: initialColor,
	onSave,
	onCancel,
}: {
	name: string;
	color: string | null;
	onSave: (name: string, color: string | null) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState(initialName);
	const [color, setColor] = useState<string | null>(initialColor);

	return (
		<div className="flex items-center gap-3 py-2 px-3 rounded-md border border-primary/30 bg-background">
			<ColorPicker value={color} onChange={setColor} />
			<input
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				className="flex-1 bg-transparent text-sm text-foreground outline-none"
				aria-label="Edit tag name"
				ref={(el) => el?.focus()}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						onSave(name.trim(), color);
					}
					if (e.key === "Escape") {
						onCancel();
					}
				}}
			/>
			<button
				type="button"
				onClick={() => onSave(name.trim(), color)}
				disabled={!name.trim()}
				className="text-primary hover:text-primary/80 transition-colors"
				aria-label="Save tag"
			>
				<Check className="h-4 w-4" />
			</button>
			<button
				type="button"
				onClick={onCancel}
				className="text-muted-foreground hover:text-foreground transition-colors"
				aria-label="Cancel edit"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}

function ColorPicker({
	value,
	onChange,
}: {
	value: string | null;
	onChange: (color: string | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [hexInput, setHexInput] = useState("");

	const isValidHex = /^#[0-9a-fA-F]{6}$/.test(hexInput);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="h-5 w-5 rounded-full border border-border shrink-0"
				style={{ backgroundColor: value ?? "#d1d5db" }}
				aria-label="Pick color"
			/>
			{open && (
				<div className="absolute top-7 left-0 z-10 rounded-lg border border-border bg-popover p-2 shadow-md">
					<div className="grid grid-cols-6 gap-1">
						<button
							type="button"
							onClick={() => {
								onChange(null);
								setOpen(false);
							}}
							className="h-5 w-5 rounded-full border border-border bg-gray-200"
							aria-label="No color"
						/>
						{PRESET_HEX_VALUES.map((hex) => (
							<button
								key={hex}
								type="button"
								onClick={() => {
									onChange(hex);
									setOpen(false);
								}}
								className={`h-5 w-5 rounded-full border ${value === hex ? "border-foreground ring-1 ring-foreground" : "border-border"}`}
								style={{ backgroundColor: hex }}
								aria-label={`Color ${hex}`}
							/>
						))}
					</div>
					<div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
						<input
							type="text"
							value={hexInput}
							onChange={(e) => setHexInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && isValidHex) {
									onChange(hexInput.toLowerCase());
									setHexInput("");
									setOpen(false);
								}
							}}
							placeholder="#000000"
							className="w-[5.5rem] rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground"
							aria-label="Custom hex color"
						/>
						{isValidHex && (
							<button
								type="button"
								onClick={() => {
									onChange(hexInput.toLowerCase());
									setHexInput("");
									setOpen(false);
								}}
								className="h-5 w-5 rounded-full border border-border"
								style={{ backgroundColor: hexInput }}
								aria-label="Apply custom color"
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
