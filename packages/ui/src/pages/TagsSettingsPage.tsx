import type { TagScope } from "@bogo/shared";
import {
	Button,
	Input,
	LayerCard,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { TagBadge } from "@/components/TagBadge";
import { PRESET_HEX_VALUES } from "@/lib/tag-colors";
import { useTags } from "@/viewmodels/tag/use-tags";

export function TagsSettingsPage() {
	const [scope, setScope] = useState<TagScope>("document");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const vm = useTags(scope);

	return (
		<div className="space-y-5">
			<PageHeader
				title="Tags"
				description="Keep related people and documents connected with shared labels."
				actions={
					<Button
						onClick={() => setEditingId("new")}
						disabled={editingId === "new" || vm.isLoading}
						aria-label="Create tag"
					>
						<Plus className="h-4 w-4" strokeWidth={1.5} />
						Add tag
					</Button>
				}
			/>
			<Tabs
				value={scope}
				onValueChange={(value) => {
					setScope(value as TagScope);
					setEditingId(null);
					setDeletingId(null);
				}}
			>
				<TabsList aria-label="Tag scope">
					<TabsTrigger value="document">Document Tags</TabsTrigger>
					<TabsTrigger value="person">Person Tags</TabsTrigger>
				</TabsList>
				<TabsContent value={scope} className="mt-4">
					<LayerCard className="space-y-3">
						{vm.isLoading ? (
							<LayerCard.Loading label="Loading tags" />
						) : vm.error ? (
							<p className="text-sm text-basalt-danger" role="alert">
								Failed to load tags: {vm.error.message}
							</p>
						) : (
							<>
								{editingId === "new" && (
									<TagForm
										scope={scope}
										onSubmit={(name, color) => {
											vm.create({ name, scope, color });
											setEditingId(null);
										}}
										onCancel={() => setEditingId(null)}
									/>
								)}
								{vm.tags.length === 0 && editingId !== "new" && (
									<p className="py-8 text-center text-sm text-basalt-muted-foreground">
										No tags defined for this scope yet.
									</p>
								)}
								{vm.tags.map((tag) =>
									editingId === tag.id ? (
										<TagForm
											key={tag.id}
											scope={scope}
											initialTag={tag}
											onSubmit={(name, color) => {
												vm.update(tag.id, { name, color });
												setEditingId(null);
											}}
											onCancel={() => setEditingId(null)}
										/>
									) : deletingId === tag.id ? (
										<div
											key={tag.id}
											className="flex flex-wrap items-center gap-2 rounded-lg bg-basalt-danger-tint p-3"
										>
											<span className="min-w-0 flex-1 break-words text-sm">
												Delete &quot;{tag.name}&quot;?
											</span>
											<Button
												size="sm"
												variant="destructive"
												disabled={vm.isRemoving}
												onClick={() => {
													vm.remove(tag.id);
													setDeletingId(null);
												}}
											>
												Confirm
											</Button>
											<Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
												Cancel
											</Button>
										</div>
									) : (
										<div
											key={tag.id}
											className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-basalt-accent/50"
										>
											<TagBadge name={tag.name} color={tag.color} />
											<span
												className="ml-auto text-xs tabular-nums text-basalt-muted-foreground"
												title="Assigned items"
											>
												{tag.assignedCount}
											</span>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												aria-label={`Edit ${tag.name}`}
												onClick={() => setEditingId(tag.id)}
											>
												<Pencil className="h-4 w-4" strokeWidth={1.5} />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-basalt-muted-foreground hover:text-basalt-danger"
												aria-label={`Delete ${tag.name}`}
												onClick={() => setDeletingId(tag.id)}
											>
												<Trash2 className="h-4 w-4" strokeWidth={1.5} />
											</Button>
										</div>
									),
								)}
							</>
						)}
					</LayerCard>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function TagForm({
	scope,
	initialTag,
	onSubmit,
	onCancel,
}: {
	scope: TagScope;
	initialTag?: { name: string; color: string | null };
	onSubmit: (name: string, color: string | null) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState(initialTag?.name ?? "");
	const [color, setColor] = useState(initialTag?.color ?? null);
	return (
		<LayerCard.Well className="p-3">
			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (name.trim()) onSubmit(name.trim(), color);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") onCancel();
				}}
			>
				<ColorPicker value={color} onChange={setColor} />
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					className="min-w-0 flex-1"
					aria-label={initialTag ? "Edit tag name" : "Tag name"}
					placeholder={`New ${scope} tag name…`}
					autoFocus
				/>
				<Button
					type="submit"
					size="sm"
					disabled={!name.trim()}
					aria-label={initialTag ? "Save tag" : "Create"}
				>
					{initialTag ? <Check className="h-4 w-4" strokeWidth={1.5} /> : "Create"}
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={onCancel}
					aria-label={initialTag ? "Cancel edit" : "Cancel create"}
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</Button>
			</form>
		</LayerCard.Well>
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
	const pick = (color: string | null) => {
		onChange(color);
		setOpen(false);
		setHexInput("");
	};
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Pick color">
					<span
						className="h-5 w-5 rounded-full border border-basalt-border bg-basalt-muted"
						style={value ? { backgroundColor: value } : undefined}
					/>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-56 p-3" aria-label="Tag color">
				<div className="grid grid-cols-6 gap-2">
					<button
						type="button"
						onClick={() => pick(null)}
						className="h-6 w-6 rounded-full border border-basalt-border bg-basalt-muted"
						aria-label="No color"
					/>
					{PRESET_HEX_VALUES.map((hex) => (
						<button
							key={hex}
							type="button"
							onClick={() => pick(hex)}
							className={`h-6 w-6 rounded-full border border-basalt-border ${value === hex ? "ring-2 ring-basalt-foreground ring-offset-2 ring-offset-basalt-control" : ""}`}
							style={{ backgroundColor: hex }}
							aria-label={`Color ${hex}`}
							aria-pressed={value === hex}
						/>
					))}
				</div>
				<div className="mt-3 flex items-center gap-2">
					<Input
						size="sm"
						value={hexInput}
						onChange={(event) => setHexInput(event.target.value)}
						placeholder="#000000"
						aria-label="Custom hex color"
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								if (isValidHex) pick(hexInput.toLowerCase());
							}
						}}
					/>
					<Button
						size="icon"
						variant="outline"
						className="h-8 w-8 shrink-0"
						disabled={!isValidHex}
						onClick={() => pick(hexInput.toLowerCase())}
						aria-label="Apply custom color"
					>
						<Check className="h-4 w-4" strokeWidth={1.5} />
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
