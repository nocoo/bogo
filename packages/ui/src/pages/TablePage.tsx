import type { ColumnKey, ViewFilter, ViewSort } from "@bogo/shared";
import { DEFAULT_TABLE_VIEW_COLUMNS, DEFAULT_TABLE_VIEW_NAME } from "@bogo/shared";
import { Columns3, Plus, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { TagBadge } from "@/components/TagBadge";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";
import { builtinColumnMetas, resolveColumnMeta } from "@/viewmodels/table/column-catalog";
import { indexPersons } from "@/viewmodels/table/resolve-cell";
import { useTableGrid } from "@/viewmodels/table/use-table-grid";
import { useTableViews } from "@/viewmodels/table/use-table-views";

const FILTER_OPS = [
	"eq",
	"neq",
	"contains",
	"not_contains",
	"gt",
	"gte",
	"lt",
	"lte",
	"is_empty",
	"is_not_empty",
	"in",
] as const;

export function TablePage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const viewParam = searchParams.get("view");
	const { workspaceId } = useWorkspaceContext();

	const {
		views,
		defaultView,
		activeView,
		isLoading: viewsLoading,
		createView,
		updateView,
		deleteView,
		isSaving,
	} = useTableViews(viewParam);

	// Invalid / cross-workspace ?view= → fallback default + replace URL
	useEffect(() => {
		if (viewsLoading || views.length === 0) return;
		if (!viewParam) {
			if (defaultView) {
				setSearchParams({ view: defaultView.id }, { replace: true });
			}
			return;
		}
		const found = views.some((v) => v.id === viewParam);
		if (!found && defaultView) {
			setSearchParams({ view: defaultView.id }, { replace: true });
		}
	}, [viewsLoading, views, viewParam, defaultView, setSearchParams]);

	const { grid, defs, persons, isLoading: gridLoading } = useTableGrid(activeView);

	const [configOpen, setConfigOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [draftColumns, setDraftColumns] = useState<ColumnKey[]>([]);
	const [filterDraft, setFilterDraft] = useState<ViewFilter[]>([]);
	const [newViewName, setNewViewName] = useState("");

	useEffect(() => {
		if (activeView) {
			setDraftColumns(activeView.columns as ColumnKey[]);
			setFilterDraft(activeView.filters);
		}
	}, [activeView]);

	const columnMetas = useMemo(() => {
		if (!activeView) return [];
		return activeView.columns.map((k) => resolveColumnMeta(k as ColumnKey, defs));
	}, [activeView, defs]);

	const availableColumns = useMemo(() => {
		const builtins = builtinColumnMetas();
		const custom = defs.map((d) => resolveColumnMeta(`field:${d.id}` as ColumnKey, defs));
		return [...builtins, ...custom];
	}, [defs]);

	const personsById = useMemo(() => indexPersons(persons), [persons]);

	const activeFilterCount = activeView?.filters.length ?? 0;

	const handleSortClick = useCallback(
		async (key: ColumnKey, sortable: boolean) => {
			if (!activeView || !sortable) return;
			const cur = activeView.sort;
			let next: ViewSort;
			if (!cur || cur.key !== key) next = { key, direction: "asc" };
			else if (cur.direction === "asc") next = { key, direction: "desc" };
			else next = null;
			await updateView(activeView.id, { sort: next });
		},
		[activeView, updateView],
	);

	const saveColumns = async () => {
		if (!activeView) return;
		const cols = draftColumns.includes("builtin:name")
			? draftColumns
			: (["builtin:name", ...draftColumns] as ColumnKey[]);
		await updateView(activeView.id, { columns: cols });
		setConfigOpen(false);
	};

	const saveFilters = async () => {
		if (!activeView) return;
		await updateView(activeView.id, { filters: filterDraft });
	};

	const handleCreateView = async () => {
		const name = newViewName.trim() || "New view";
		const created = await createView({
			name,
			columns: [...DEFAULT_TABLE_VIEW_COLUMNS],
		});
		setNewViewName("");
		setSearchParams({ view: created.id });
	};

	const handleDeleteView = async () => {
		if (!activeView || activeView.isDefault) return;
		await deleteView(activeView.id);
		if (defaultView) setSearchParams({ view: defaultView.id });
	};

	const handlePromoteDefault = async () => {
		if (!activeView || activeView.isDefault) return;
		await updateView(activeView.id, { isDefault: true });
	};

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
				Select a workspace to open the people table.
			</div>
		);
	}

	const loading = viewsLoading || gridLoading;

	return (
		<div className="flex h-full min-h-0 flex-col gap-3">
			{/* L1 toolbar — lives on page card */}
			<header className="page-toolbar shrink-0 border-b border-border/60 pb-3">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="page-toolbar-label">View</span>
					<select
						className="field-select min-w-[10rem] max-w-[16rem]"
						value={activeView?.id ?? ""}
						onChange={(e) => setSearchParams({ view: e.target.value })}
						aria-label="Table view"
					>
						{views.map((v) => (
							<option key={v.id} value={v.id}>
								{v.name}
								{v.isDefault ? " ★" : ""}
							</option>
						))}
					</select>

					<button
						type="button"
						className={cn("btn-secondary", configOpen && "bg-accent text-accent-foreground")}
						onClick={() => {
							setConfigOpen((o) => !o);
							if (!configOpen) setFiltersOpen(false);
						}}
						aria-pressed={configOpen}
					>
						<Columns3 className="h-3.5 w-3.5" strokeWidth={1.75} />
						Columns
					</button>

					<button
						type="button"
						className={cn("btn-secondary", filtersOpen && "bg-accent text-accent-foreground")}
						onClick={() => {
							setFiltersOpen((o) => !o);
							if (!filtersOpen) setConfigOpen(false);
						}}
						aria-pressed={filtersOpen}
					>
						Filters
						{activeFilterCount > 0 && (
							<span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
								{activeFilterCount}
							</span>
						)}
					</button>

					<button
						type="button"
						className="btn-ghost"
						onClick={handlePromoteDefault}
						disabled={!activeView || activeView.isDefault || isSaving}
						title="Set as default view"
					>
						<Star className="h-3.5 w-3.5" strokeWidth={1.75} />
						Default
					</button>

					<button
						type="button"
						className="btn-destructive"
						onClick={handleDeleteView}
						disabled={!activeView || activeView.isDefault || isSaving}
					>
						<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
						Delete
					</button>
				</div>

				<div className="ml-auto flex items-center gap-2">
					<input
						className="field w-36 sm:w-44"
						placeholder="New view name"
						value={newViewName}
						onChange={(e) => setNewViewName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void handleCreateView();
						}}
					/>
					<button
						type="button"
						className="btn-primary"
						onClick={handleCreateView}
						disabled={isSaving}
					>
						<Plus className="h-3.5 w-3.5" strokeWidth={2} />
						New view
					</button>
				</div>
			</header>

			{/* L2 — Columns config panel */}
			{configOpen && (
				<section className="panel-l2 shrink-0 p-4">
					<div className="mb-3 flex items-center justify-between gap-2">
						<h2 className="text-sm font-semibold text-foreground">Columns</h2>
						<p className="text-xs text-muted-foreground">Name is always required</p>
					</div>
					<ul className="panel-l3 mb-3 max-h-48 space-y-0.5 overflow-auto p-2 text-sm">
						{availableColumns.map((col) => {
							const checked = draftColumns.includes(col.key);
							const locked = col.key === "builtin:name";
							return (
								<li key={col.key}>
									<label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/60">
										<input
											type="checkbox"
											className="size-3.5 accent-primary"
											checked={checked || locked}
											disabled={locked}
											onChange={() => {
												setDraftColumns((prev) =>
													prev.includes(col.key)
														? prev.filter((k) => k !== col.key)
														: [...prev, col.key],
												);
											}}
										/>
										<span className="min-w-0 flex-1 font-medium text-foreground">{col.label}</span>
										<span className="truncate font-mono text-[11px] text-muted-foreground">
											{col.key}
										</span>
									</label>
								</li>
							);
						})}
					</ul>
					<div className="flex justify-end gap-2">
						<button type="button" className="btn-ghost" onClick={() => setConfigOpen(false)}>
							Cancel
						</button>
						<button type="button" className="btn-primary" onClick={saveColumns} disabled={isSaving}>
							Save columns
						</button>
					</div>
				</section>
			)}

			{/* L2 — Filters panel */}
			{filtersOpen && (
				<section className="panel-l2 shrink-0 p-4">
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<h2 className="text-sm font-semibold text-foreground">Filters</h2>
						<span className="text-xs text-muted-foreground">AND across all rules</span>
						<div className="ml-auto flex items-center gap-2">
							<button
								type="button"
								className="btn-secondary btn-sm"
								onClick={() =>
									setFilterDraft((d) => [...d, { key: "builtin:name", op: "contains", value: "" }])
								}
							>
								Add filter
							</button>
							<button
								type="button"
								className="btn-primary btn-sm"
								onClick={saveFilters}
								disabled={isSaving}
							>
								Save filters
							</button>
						</div>
					</div>

					{filterDraft.length === 0 ? (
						<p className="py-4 text-center text-sm text-muted-foreground">
							No filters yet. Add one to narrow the grid.
						</p>
					) : (
						<ul className="space-y-2">
							{filterDraft.map((f, i) => (
								<li
									// biome-ignore lint/suspicious/noArrayIndexKey: draft filter rows have no stable id
									key={`filter-row-${i}`}
									className="panel-l3 flex flex-wrap items-center gap-2 p-2"
								>
									<select
										className="field-select field-sm"
										value={f.key}
										onChange={(e) => {
											const key = e.target.value;
											setFilterDraft((d) => d.map((x, j) => (j === i ? { ...x, key } : x)));
										}}
									>
										{columnMetas
											.filter((c) => c.filterable)
											.map((c) => (
												<option key={c.key} value={c.key}>
													{c.label}
												</option>
											))}
									</select>
									<select
										className="field-select field-sm min-w-[7rem]"
										value={f.op}
										onChange={(e) => {
											const op = e.target.value as ViewFilter["op"];
											setFilterDraft((d) =>
												d.map((x, j) =>
													j === i
														? {
																...x,
																op,
																value:
																	op === "is_empty" || op === "is_not_empty"
																		? null
																		: (x.value ?? ""),
															}
														: x,
												),
											);
										}}
									>
										{FILTER_OPS.map((op) => (
											<option key={op} value={op}>
												{op}
											</option>
										))}
									</select>
									{f.op !== "is_empty" && f.op !== "is_not_empty" && f.op !== "in" && (
										<input
											className="field field-sm min-w-[8rem] flex-1"
											value={typeof f.value === "string" ? f.value : ""}
											onChange={(e) => {
												const value = e.target.value;
												setFilterDraft((d) => d.map((x, j) => (j === i ? { ...x, value } : x)));
											}}
										/>
									)}
									{f.op === "in" && (
										<input
											className="field field-sm min-w-[10rem] flex-1"
											placeholder="comma-separated ids"
											value={Array.isArray(f.value) ? f.value.join(",") : ""}
											onChange={(e) => {
												const value = e.target.value
													.split(",")
													.map((s) => s.trim())
													.filter(Boolean);
												setFilterDraft((d) => d.map((x, j) => (j === i ? { ...x, value } : x)));
											}}
										/>
									)}
									<button
										type="button"
										className="btn-ghost btn-sm"
										onClick={() => setFilterDraft((d) => d.filter((_, j) => j !== i))}
									>
										Remove
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{/* L2 table shell */}
			<div className="data-table-shell">
				{loading && <p className="p-6 text-sm text-muted-foreground">Loading table…</p>}
				{!loading && grid && grid.total === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
						<p>No people yet.</p>
						<Link to="/people" className="btn-primary btn-sm">
							Go to People
						</Link>
					</div>
				)}
				{!loading && grid && grid.total > 0 && (
					<table className="data-table">
						<thead>
							<tr>
								{columnMetas.map((col) => {
									const sort = activeView?.sort;
									const ariaSort =
										sort?.key === col.key
											? sort.direction === "asc"
												? "ascending"
												: "descending"
											: "none";
									return (
										<th key={col.key} scope="col" aria-sort={col.sortable ? ariaSort : undefined}>
											{col.sortable ? (
												<button
													type="button"
													className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground hover:text-foreground"
													onClick={() => handleSortClick(col.key, true)}
												>
													{col.label}
													{sort?.key === col.key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
												</button>
											) : (
												col.label
											)}
										</th>
									);
								})}
							</tr>
						</thead>
						<tbody>
							{grid.rows.map((row) => (
								<tr key={row.person.id}>
									{columnMetas.map((col) => {
										const cell = row.cells[col.key];
										const isName = col.key === "builtin:name";
										const isPersonRef = col.kind === "person-ref";
										return (
											<td
												key={col.key}
												className={cn(cell?.isDefault && "italic text-muted-foreground")}
											>
												{isName ? (
													<Link
														to={`/people/${row.person.id}`}
														className="inline-flex max-w-full items-center gap-2 font-medium text-primary hover:underline"
													>
														<PersonAvatar
															name={row.person.name}
															avatarUrl={row.person.avatarUrl}
															size="xs"
														/>
														<span className="truncate">{cell?.display ?? "—"}</span>
													</Link>
												) : isPersonRef && cell?.refId && cell.raw ? (
													<span className="inline-flex max-w-full items-center gap-2">
														<PersonAvatar
															name={cell.display}
															avatarUrl={personsById.get(cell.refId)?.avatarUrl}
															size="xs"
														/>
														<span className="truncate">{cell.display}</span>
													</span>
												) : col.kind === "tags" && cell?.tags ? (
													<span className="flex flex-wrap items-center gap-1">
														{cell.tags.map((t) => (
															<TagBadge key={t.id} name={t.name} color={t.color} size="sm" />
														))}
														{cell.tags.length === 0 ? "—" : null}
													</span>
												) : (
													(cell?.display ?? "—")
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<footer className="shrink-0 text-xs text-muted-foreground">
				{grid ? `${grid.filteredCount} of ${grid.total} people` : null}
				{grid?.skippedSort ? " · sort column unavailable" : ""}
				{grid && grid.skippedFilters > 0 ? ` · ${grid.skippedFilters} filter(s) skipped` : ""}
				{activeView ? ` · ${activeView.name || DEFAULT_TABLE_VIEW_NAME}` : ""}
			</footer>
		</div>
	);
}
