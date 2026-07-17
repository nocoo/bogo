import type { ColumnKey, ViewFilter, ViewSort } from "@bogo/shared";
import {
	DEFAULT_TABLE_VIEW_COLUMNS,
	DEFAULT_TABLE_VIEW_NAME,
	fieldIdFromColumnKey,
} from "@bogo/shared";
import { Columns3, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { TagBadge } from "@/components/TagBadge";
import { ColumnPicker } from "@/components/table/ColumnPicker";
import { FilterValueInput } from "@/components/table/FilterValueInput";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";
import { builtinColumnMetas, resolveColumnMeta } from "@/viewmodels/table/column-catalog";
import { ensureNameColumn } from "@/viewmodels/table/column-picker";
import { opsForKind } from "@/viewmodels/table/filter-ops";
import { indexPersons } from "@/viewmodels/table/resolve-cell";
import { useTableGrid } from "@/viewmodels/table/use-table-grid";
import { useTableViews } from "@/viewmodels/table/use-table-views";
import { validateFilterDraft } from "@/viewmodels/table/validate-filter-draft";
import { useTags } from "@/viewmodels/tag/use-tags";

export function TablePage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const viewParam = searchParams.get("view");
	const { workspaceId } = useWorkspaceContext();

	const {
		views,
		defaultView,
		activeView,
		isLoading: viewsLoading,
		isError: viewsError,
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

	const {
		grid,
		defs,
		persons,
		isLoading: gridLoading,
		isError: gridError,
	} = useTableGrid(activeView);
	const tagsVm = useTags("person");

	const [configOpen, setConfigOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [draftColumns, setDraftColumns] = useState<ColumnKey[]>([]);
	const [filterDraft, setFilterDraft] = useState<ViewFilter[]>([]);
	const [filterError, setFilterError] = useState<string | null>(null);
	const [newViewName, setNewViewName] = useState("");

	// Reset drafts only when switching views — not when sort/filter PUT refreshes activeView
	const activeViewId = activeView?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-seed drafts on view id change
	useEffect(() => {
		if (!activeView) return;
		setDraftColumns(activeView.columns as ColumnKey[]);
		setFilterDraft(activeView.filters);
		setFilterError(null);
		setConfigOpen(false);
		setFiltersOpen(false);
	}, [activeViewId]);

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

	const tableReturnPath = activeView ? `/table?view=${activeView.id}` : "/table";

	const activeFilterCount = activeView?.filters.length ?? 0;

	const handleSortClick = useCallback(
		async (key: ColumnKey, sortable: boolean) => {
			if (!activeView || !sortable) return;
			const cur = activeView.sort;
			let next: ViewSort;
			if (!cur || cur.key !== key) next = { key, direction: "asc" };
			else if (cur.direction === "asc") next = { key, direction: "desc" };
			else next = null;
			try {
				await updateView(activeView.id, { sort: next });
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Failed to update sort");
			}
		},
		[activeView, updateView],
	);

	const saveColumns = async () => {
		if (!activeView) return;
		try {
			await updateView(activeView.id, { columns: ensureNameColumn(draftColumns) });
			setConfigOpen(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to save columns");
		}
	};

	const saveFilters = async () => {
		if (!activeView) return;
		const err = validateFilterDraft(filterDraft, columnMetas, defs);
		if (err) {
			setFilterError(err);
			toast.error(err);
			return;
		}
		setFilterError(null);
		try {
			await updateView(activeView.id, { filters: filterDraft });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to save filters");
		}
	};

	const handleCreateView = async () => {
		const name = newViewName.trim() || "New view";
		try {
			const created = await createView({
				name,
				columns: [...DEFAULT_TABLE_VIEW_COLUMNS],
			});
			setNewViewName("");
			setSearchParams({ view: created.id });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to create view");
		}
	};

	const handleDeleteView = async () => {
		if (!activeView || activeView.isDefault) return;
		try {
			await deleteView(activeView.id);
			if (defaultView) setSearchParams({ view: defaultView.id });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to delete view");
		}
	};

	const handlePromoteDefault = async () => {
		if (!activeView || activeView.isDefault) return;
		try {
			await updateView(activeView.id, { isDefault: true });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to set default view");
		}
	};

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
				Select a workspace to open the people table.
			</div>
		);
	}

	if (viewsError || gridError) {
		return (
			<div
				className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
				role="alert"
			>
				Failed to load the people table. Check that the API is reachable and D1 migrations are
				applied.
			</div>
		);
	}

	const loading = viewsLoading || gridLoading;

	const opsForColumn = (key: string) => {
		const kind = columnMetas.find((c) => c.key === key)?.kind ?? "text";
		return opsForKind(kind);
	};

	return (
		<div className="flex h-full min-h-0 flex-col gap-3">
			{/* L1 toolbar — view switcher + tools */}
			<header className="shrink-0 space-y-2.5 border-b border-border/60 pb-3">
				{/* View strip: segmented tabs + create */}
				<div className="flex min-w-0 items-center gap-2">
					<nav className="view-switcher min-w-0 flex-1" aria-label="Table views">
						{views.map((v) => {
							const active = activeView?.id === v.id;
							return (
								<button
									key={v.id}
									type="button"
									className={cn("view-tab", active && "view-tab-active")}
									onClick={() => setSearchParams({ view: v.id })}
									aria-current={active ? "page" : undefined}
								>
									<span className="max-w-[9rem] truncate">{v.name}</span>
									{v.isDefault ? (
										<span className={cn(active ? "badge-soft" : "badge-soft-muted")}>Default</span>
									) : null}
								</button>
							);
						})}
					</nav>

					<div className="flex shrink-0 items-center gap-1.5">
						<input
							className="field field-sm w-28 sm:w-36"
							placeholder="Name…"
							value={newViewName}
							onChange={(e) => setNewViewName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") void handleCreateView();
							}}
							aria-label="New view name"
						/>
						<button
							type="button"
							className="btn-secondary btn-sm"
							onClick={handleCreateView}
							disabled={isSaving}
							title="Create view"
						>
							<Plus className="h-3.5 w-3.5" strokeWidth={2} />
							<span className="hidden sm:inline">New</span>
						</button>
					</div>
				</div>

				{/* Active-view tools */}
				<div className="page-toolbar">
					<button
						type="button"
						className={cn("btn-secondary", configOpen && "bg-accent text-accent-foreground")}
						onClick={() => {
							if (!configOpen && activeView) {
								setDraftColumns(activeView.columns as ColumnKey[]);
								setFiltersOpen(false);
							}
							setConfigOpen((o) => !o);
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
							if (!filtersOpen && activeView) {
								setFilterDraft(activeView.filters);
								setFilterError(null);
								setConfigOpen(false);
							}
							setFiltersOpen((o) => !o);
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

					<div className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />

					{activeView?.isDefault ? (
						<span
							className="inline-flex h-8 items-center gap-1.5 px-1 text-xs text-muted-foreground"
							title="This view opens when you visit Table"
						>
							<span className="badge-soft">Default</span>
							<span className="hidden sm:inline">Opens first</span>
						</span>
					) : (
						<button
							type="button"
							className="btn-ghost"
							onClick={handlePromoteDefault}
							disabled={!activeView || isSaving}
							title="Open this view first when visiting Table"
						>
							Make default
						</button>
					)}

					<button
						type="button"
						className="btn-destructive"
						onClick={handleDeleteView}
						disabled={!activeView || activeView.isDefault || isSaving}
						title={
							activeView?.isDefault
								? "The default view cannot be deleted — promote another first"
								: "Delete this view"
						}
					>
						<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
						Delete
					</button>
				</div>
			</header>

			{/* L2 — Columns config panel (selected top / available bottom, drag reorder) */}
			{configOpen && (
				<section className="panel-l2 shrink-0 p-4">
					<div className="mb-3 flex items-center justify-between gap-2">
						<h2 className="text-sm font-semibold text-foreground">Columns</h2>
						<p className="text-xs text-muted-foreground">Name is always required</p>
					</div>
					<ColumnPicker
						selected={draftColumns}
						catalog={availableColumns}
						onChange={setDraftColumns}
					/>
					<div className="mt-4 flex justify-end gap-2">
						<button
							type="button"
							className="btn-ghost"
							onClick={() => {
								if (activeView) {
									setDraftColumns(activeView.columns as ColumnKey[]);
								}
								setConfigOpen(false);
							}}
						>
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
											const allowed = opsForColumn(key);
											const op = (allowed.includes(f.op) ? f.op : allowed[0]) as ViewFilter["op"];
											setFilterDraft((d) =>
												d.map((x, j) =>
													j === i
														? {
																...x,
																key,
																op,
																value:
																	op === "is_empty" || op === "is_not_empty"
																		? null
																		: op === "in"
																			? []
																			: "",
															}
														: x,
												),
											);
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
										value={
											opsForColumn(f.key).includes(f.op) ? f.op : (opsForColumn(f.key)[0] ?? "eq")
										}
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
																		: op === "in"
																			? []
																			: typeof x.value === "string"
																				? x.value
																				: "",
															}
														: x,
												),
											);
										}}
									>
										{opsForColumn(f.key).map((op) => (
											<option key={op} value={op}>
												{op}
											</option>
										))}
									</select>
									<FilterValueInput
										filter={f}
										meta={columnMetas.find((c) => c.key === f.key)}
										def={(() => {
											const fid = fieldIdFromColumnKey(f.key);
											return fid ? defs.find((d) => d.id === fid) : undefined;
										})()}
										personTags={tagsVm.tags.map((t) => ({ id: t.id, name: t.name }))}
										onChange={(value) => {
											setFilterDraft((d) => d.map((x, j) => (j === i ? { ...x, value } : x)));
										}}
									/>
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
					{filterError ? (
						<p className="mt-2 text-xs text-destructive" role="alert">
							{filterError}
						</p>
					) : null}
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
														to={`/people/${row.person.id}?from=${encodeURIComponent(tableReturnPath)}`}
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

			<footer className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
				<span>{grid ? `${grid.filteredCount} of ${grid.total} people` : null}</span>
				{grid?.skippedSort ? <span>· sort column unavailable</span> : null}
				{grid && grid.skippedFilters > 0 ? (
					<span>· {grid.skippedFilters} filter(s) skipped</span>
				) : null}
				{activeView ? (
					<span className="inline-flex items-center gap-1.5">
						· {activeView.name || DEFAULT_TABLE_VIEW_NAME}
						{activeView.isDefault ? <span className="badge-soft-muted">Default</span> : null}
					</span>
				) : null}
			</footer>
		</div>
	);
}
