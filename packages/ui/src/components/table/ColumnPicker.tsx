import type { ColumnKey } from "@bogo/shared";
import { ChevronLeft, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { ColumnMeta } from "@/viewmodels/table/column-catalog";
import {
	addColumn,
	isLockedColumn,
	nudgeColumn,
	removeColumn,
	reorderSelected,
} from "@/viewmodels/table/column-picker";

type DragSource = "selected" | "available";

type DragState = {
	key: ColumnKey;
	from: DragSource;
};

export function ColumnPicker({
	selected,
	catalog,
	onChange,
}: {
	selected: ColumnKey[];
	/** Full catalog of pickable columns (builtins + custom). */
	catalog: ColumnMeta[];
	onChange: (next: ColumnKey[]) => void;
}) {
	const dndId = useId();
	const [drag, setDrag] = useState<DragState | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);
	const [overZone, setOverZone] = useState<"selected" | "available" | null>(null);

	const metaByKey = new Map(catalog.map((c) => [c.key, c]));
	const selectedSet = new Set(selected);
	const available = catalog.filter((c) => !selectedSet.has(c.key));

	const labelOf = (key: ColumnKey) => metaByKey.get(key)?.label ?? key;

	const onDragStart = useCallback((key: ColumnKey, from: DragSource) => {
		setDrag({ key, from });
	}, []);

	const clearDrag = useCallback(() => {
		setDrag(null);
		setOverIndex(null);
		setOverZone(null);
	}, []);

	const dropOnSelected = useCallback(
		(atIndex: number) => {
			if (!drag) return;
			if (drag.from === "selected") {
				onChange(reorderSelected(selected, drag.key, atIndex));
			} else {
				const withAdd = addColumn(selected, drag.key);
				onChange(reorderSelected(withAdd, drag.key, atIndex));
			}
			clearDrag();
		},
		[drag, selected, onChange, clearDrag],
	);

	const dropOnAvailable = useCallback(() => {
		if (!drag) return;
		if (drag.from === "selected") {
			onChange(removeColumn(selected, drag.key));
		}
		clearDrag();
	}, [drag, selected, onChange, clearDrag]);

	return (
		<div className="space-y-4">
			{/* Selected — horizontal chips, drag left/right to reorder */}
			<div>
				<div className="mb-1.5 flex items-baseline justify-between gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Selected
					</h3>
					<p className="text-[11px] text-muted-foreground">Drag left/right to reorder</p>
				</div>
				<ul
					className={cn(
						"panel-l3 flex min-h-12 list-none flex-wrap items-center gap-1.5 p-2 transition-colors",
						overZone === "selected" && "bg-primary/5 ring-2 ring-primary/30",
					)}
					onDragOver={(e) => {
						e.preventDefault();
						setOverZone("selected");
						if (overIndex === null) setOverIndex(selected.length);
					}}
					onDragLeave={() => {
						setOverZone(null);
						setOverIndex(null);
					}}
					onDrop={(e) => {
						e.preventDefault();
						dropOnSelected(overIndex ?? selected.length);
					}}
					aria-label="Selected columns"
				>
					{selected.length === 0 ? (
						<li className="list-none px-1 text-xs text-muted-foreground">Drop columns here</li>
					) : (
						selected.map((key, index) => {
							const locked = isLockedColumn(key);
							return (
								<li key={key} className="flex list-none items-center gap-0.5">
									{overIndex === index && drag ? (
										<span className="h-7 w-0.5 shrink-0 rounded-full bg-primary" aria-hidden />
									) : null}
									{/* biome-ignore lint/a11y/noStaticElementInteractions: HTML5 DnD drop target */}
									<div
										onDragOver={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setOverZone("selected");
											setOverIndex(index);
										}}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											dropOnSelected(index);
										}}
										className={cn(
											"group inline-flex h-8 max-w-[12rem] items-center gap-1 rounded-md border border-border bg-card px-1.5 text-sm",
											drag?.key === key && "opacity-50",
											locked && "border-primary/25 bg-primary/5",
										)}
									>
										{/* Drag handle only — other chip controls stay clickable */}
										<button
											type="button"
											draggable
											onDragStart={(e) => {
												e.dataTransfer.effectAllowed = "move";
												e.dataTransfer.setData(`${dndId}/key`, key);
												onDragStart(key, "selected");
											}}
											onDragEnd={clearDrag}
											className="inline-flex cursor-grab items-center rounded-sm text-muted-foreground active:cursor-grabbing"
											aria-label={`Drag ${labelOf(key)}`}
										>
											<GripVertical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
										</button>
										<span className="min-w-0 truncate font-medium text-foreground">
											{labelOf(key)}
										</span>
										{locked ? (
											<span className="badge-soft-muted shrink-0">Required</span>
										) : (
											<button
												type="button"
												className="btn-icon h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
												aria-label={`Remove ${labelOf(key)}`}
												onClick={() => onChange(removeColumn(selected, key))}
											>
												<X className="h-3 w-3" strokeWidth={2} />
											</button>
										)}
										<span className="flex shrink-0 items-center border-l border-border/70 pl-0.5">
											<button
												type="button"
												className="btn-icon h-6 w-5"
												aria-label={`Move ${labelOf(key)} left`}
												disabled={index === 0}
												onClick={() => onChange(nudgeColumn(selected, key, "left"))}
											>
												<ChevronLeft className="h-3 w-3" strokeWidth={2} />
											</button>
											<button
												type="button"
												className="btn-icon h-6 w-5"
												aria-label={`Move ${labelOf(key)} right`}
												disabled={index === selected.length - 1}
												onClick={() => onChange(nudgeColumn(selected, key, "right"))}
											>
												<ChevronRight className="h-3 w-3" strokeWidth={2} />
											</button>
										</span>
									</div>
								</li>
							);
						})
					)}
					{overIndex === selected.length && drag ? (
						<li className="list-none" aria-hidden>
							<span className="inline-block h-7 w-0.5 rounded-full bg-primary" />
						</li>
					) : null}
				</ul>
			</div>

			{/* Available — candidates to add */}
			<div>
				<div className="mb-1.5 flex items-baseline justify-between gap-2">
					<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Available
					</h3>
					<p className="text-[11px] text-muted-foreground">Click or drag up to add</p>
				</div>
				<ul
					className={cn(
						"panel-l3 flex min-h-12 list-none flex-wrap items-center gap-1.5 p-2 transition-colors",
						overZone === "available" && "bg-primary/5 ring-2 ring-primary/30",
					)}
					onDragOver={(e) => {
						e.preventDefault();
						setOverZone("available");
					}}
					onDragLeave={() => setOverZone(null)}
					onDrop={(e) => {
						e.preventDefault();
						dropOnAvailable();
					}}
					aria-label="Available columns"
				>
					{available.length === 0 ? (
						<li className="list-none px-1 text-xs text-muted-foreground">
							All columns are selected
						</li>
					) : (
						available.map((col) => (
							<li key={col.key} className="list-none">
								{/* biome-ignore lint/a11y/noStaticElementInteractions: HTML5 DnD chip */}
								<div
									draggable
									onDragStart={(e) => {
										// Ignore drags that started on the add button
										if ((e.target as HTMLElement).closest("button")) {
											e.preventDefault();
											return;
										}
										e.dataTransfer.effectAllowed = "move";
										e.dataTransfer.setData(`${dndId}/key`, col.key);
										onDragStart(col.key, "available");
									}}
									onDragEnd={clearDrag}
									className={cn(
										"inline-flex h-8 max-w-[12rem] cursor-grab items-center gap-1 rounded-md border border-dashed border-border bg-background px-2 text-sm active:cursor-grabbing",
										drag?.key === col.key && "opacity-50",
									)}
								>
									<span className="min-w-0 truncate text-foreground">{col.label}</span>
									<button
										type="button"
										className="btn-icon h-6 w-6 shrink-0"
										aria-label={`Add ${col.label}`}
										onClick={() => onChange(addColumn(selected, col.key))}
									>
										<Plus className="h-3.5 w-3.5" strokeWidth={2} />
									</button>
								</div>
							</li>
						))
					)}
				</ul>
			</div>
		</div>
	);
}
