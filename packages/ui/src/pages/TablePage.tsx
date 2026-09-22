import type { ColumnKey, ViewFilter, ViewSort } from "@bogo/shared";
import {
	DEFAULT_TABLE_VIEW_COLUMNS,
	DEFAULT_TABLE_VIEW_NAME,
	fieldIdFromColumnKey,
} from "@bogo/shared";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Input,
	LayerCard,
} from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
import { Columns3, Ellipsis, Filter, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { PersonHover } from "@/components/person/PersonHover";
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
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
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

	const openCreateDialog = () => {
		setNewViewName("");
		setCreateDialogOpen(true);
	};

	const closeCreateDialog = () => {
		setCreateDialogOpen(false);
		setNewViewName("");
	};

	const handleCreateView = async () => {
		const name = newViewName.trim();
		if (!name) {
			toast.error("View name is required");
			return;
		}
		try {
			const created = await createView({
				name,
				columns: [...DEFAULT_TABLE_VIEW_COLUMNS],
			});
			closeCreateDialog();
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
			<div className="flex items-center justify-center py-12 text-sm text-basalt-muted-foreground">
				Select a workspace to open the people table.
			</div>
		);
	}

	if (viewsError || gridError) {
		return (
			<div
				className="rounded-lg border border-basalt-destructive/25 bg-basalt-destructive/5 p-4 text-sm text-basalt-danger"
				role="alert"
			>
				Failed to load the people table. Please try again.
			</div>
		);
	}

	const loading = viewsLoading || gridLoading;

	const opsForColumn = (key: string) => {
		const kind = columnMetas.find((c) => c.key === key)?.kind ?? "text";
		return opsForKind(kind);
	};

	return (
		<div className="flex min-h-full min-w-0 flex-col gap-4">
			<PageHeader
				title="People Table"
				description="Explore people, reporting lines, and custom fields in saved views."
				actions={
					<>
						<Button
							variant="outline"
							aria-expanded={configOpen}
							aria-controls="table-columns-panel"
							onClick={() => {
								if (!configOpen && activeView) setDraftColumns(activeView.columns as ColumnKey[]);
								setFiltersOpen(false);
								setConfigOpen((open) => !open);
							}}
						>
							<Columns3 className="h-4 w-4" strokeWidth={1.5} />
							Columns
						</Button>
						<Button
							variant="outline"
							aria-expanded={filtersOpen}
							aria-controls="table-filters-panel"
							onClick={() => {
								if (!filtersOpen && activeView) setFilterDraft(activeView.filters);
								setFilterError(null);
								setConfigOpen(false);
								setFiltersOpen((open) => !open);
							}}
						>
							<Filter className="h-4 w-4" strokeWidth={1.5} />
							Filters
							{activeFilterCount > 0 && <Badge variant="outline">{activeFilterCount}</Badge>}
						</Button>
						<Button onClick={openCreateDialog} disabled={isSaving} aria-label="New view">
							<Plus className="h-4 w-4" strokeWidth={1.5} />
							New view
						</Button>
					</>
				}
			/>
			<div className="flex min-w-0 items-center gap-2">
				<nav
					className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
					aria-label="Table views"
				>
					{views.map((view) => (
						<Button
							key={view.id}
							asChild
							variant="ghost"
							size="sm"
							className={cn(
								"shrink-0",
								activeView?.id === view.id && "bg-basalt-secondary text-basalt-foreground",
							)}
						>
							<Link
								to={`/table?view=${view.id}`}
								aria-current={activeView?.id === view.id ? "page" : undefined}
							>
								<span className="max-w-36 truncate">{view.name}</span>
								{view.isDefault && (
									<Badge variant="outline" className="text-[10px]">
										Default
									</Badge>
								)}
							</Link>
						</Button>
					))}
				</nav>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="View options">
							<Ellipsis className="h-4 w-4" strokeWidth={1.5} />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onSelect={handlePromoteDefault}
							disabled={!activeView || activeView.isDefault || isSaving}
						>
							Make default
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={handleDeleteView}
							disabled={!activeView || activeView.isDefault || isSaving}
							className="text-basalt-danger"
						>
							<Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
							Delete view
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* L2 — Columns config panel (selected top / available bottom, drag reorder) */}
			{configOpen && (
				<LayerCard id="table-columns-panel" className="shrink-0 p-4">
					<div className="mb-3 flex items-center justify-between gap-2">
						<h2 className="text-sm font-semibold text-basalt-foreground">Columns</h2>
						<p className="text-xs text-basalt-muted-foreground">Name is always required</p>
					</div>
					<ColumnPicker
						selected={draftColumns}
						catalog={availableColumns}
						onChange={setDraftColumns}
					/>
					<div className="mt-4 flex justify-end gap-2">
						<Button
							variant="ghost"
							onClick={() => {
								if (activeView) {
									setDraftColumns(activeView.columns as ColumnKey[]);
								}
								setConfigOpen(false);
							}}
						>
							Cancel
						</Button>
						<Button onClick={saveColumns} disabled={isSaving}>
							Save columns
						</Button>
					</div>
				</LayerCard>
			)}

			{/* L2 — Filters panel */}
			{filtersOpen && (
				<LayerCard id="table-filters-panel" className="shrink-0 p-4">
					<div className="mb-3 flex flex-wrap items-center gap-2">
						<h2 className="text-sm font-semibold text-basalt-foreground">Filters</h2>
						<span className="text-xs text-basalt-muted-foreground">AND across all rules</span>
						<div className="ml-auto flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setFilterDraft((d) => [...d, { key: "builtin:name", op: "contains", value: "" }])
								}
							>
								Add filter
							</Button>
							<Button size="sm" onClick={saveFilters} disabled={isSaving}>
								Save filters
							</Button>
						</div>
					</div>

					{filterDraft.length === 0 ? (
						<p className="py-4 text-center text-sm text-basalt-muted-foreground">
							No filters yet. Add one to narrow the grid.
						</p>
					) : (
						<ul className="space-y-2">
							{filterDraft.map((f, i) => (
								<li
									// biome-ignore lint/suspicious/noArrayIndexKey: draft filter rows have no stable id
									key={`filter-row-${i}`}
								>
									<LayerCard.Well className="flex flex-wrap items-center gap-2 p-2 rounded-lg">
										<Select
											value={f.key}
											onValueChange={(key) => {
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
											<SelectTrigger
												size="sm"
												className="min-w-32 flex-1"
												aria-label="Filter column"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{columnMetas
													.filter((c) => c.filterable)
													.map((c) => (
														<SelectItem key={c.key} value={c.key}>
															{c.label}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
										<Select
											value={
												opsForColumn(f.key).includes(f.op) ? f.op : (opsForColumn(f.key)[0] ?? "eq")
											}
											onValueChange={(next) => {
												const op = next as ViewFilter["op"];
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
											<SelectTrigger
												size="sm"
												className="min-w-32 flex-1"
												aria-label="Filter operator"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{opsForColumn(f.key).map((op) => (
													<SelectItem key={op} value={op}>
														{op}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
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
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setFilterDraft((d) => d.filter((_, j) => j !== i))}
										>
											Remove
										</Button>
									</LayerCard.Well>
								</li>
							))}
						</ul>
					)}
					{filterError ? (
						<p className="mt-2 text-xs text-basalt-danger" role="alert">
							{filterError}
						</p>
					) : null}
				</LayerCard>
			)}

			{/* L2 table shell */}
			<LayerCard padding="none" className="min-h-64 min-w-0 flex-1 overflow-auto">
				{loading && <p className="p-6 text-sm text-basalt-muted-foreground">Loading table…</p>}
				{!loading && grid && grid.total === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-basalt-muted-foreground">
						<p>No people yet.</p>
						<Button asChild size="sm">
							<Link to="/people">Go to People</Link>
						</Button>
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
													className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-basalt-muted-foreground hover:text-basalt-foreground"
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
												className={cn(cell?.isDefault && "italic text-basalt-muted-foreground")}
											>
												{isName ? (
													<PersonHover personId={row.person.id}>
														<Link
															to={`/people/${row.person.id}?from=${encodeURIComponent(tableReturnPath)}`}
															className="inline-flex max-w-full items-center gap-2 font-medium text-basalt-foreground"
														>
															<PersonAvatar
																name={row.person.name}
																avatarUrl={row.person.avatarUrl}
																size="xs"
															/>
															<span className="truncate">{cell?.display ?? "—"}</span>
														</Link>
													</PersonHover>
												) : isPersonRef && cell?.refId && cell.raw ? (
													<PersonHover personId={cell.refId}>
														<Link
															to={`/people/${cell.refId}?from=${encodeURIComponent(tableReturnPath)}`}
															className="inline-flex max-w-full items-center gap-2 text-basalt-foreground"
														>
															<PersonAvatar
																name={cell.display}
																avatarUrl={personsById.get(cell.refId)?.avatarUrl}
																size="xs"
															/>
															<span className="truncate">{cell.display}</span>
														</Link>
													</PersonHover>
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
			</LayerCard>

			<footer className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-basalt-muted-foreground">
				<span>{grid ? `${grid.filteredCount} of ${grid.total} people` : null}</span>
				{grid?.skippedSort ? <span>· sort column unavailable</span> : null}
				{grid && grid.skippedFilters > 0 ? (
					<span>· {grid.skippedFilters} filter(s) skipped</span>
				) : null}
				{activeView ? (
					<span className="inline-flex items-center gap-1.5">
						· {activeView.name || DEFAULT_TABLE_VIEW_NAME}
						{activeView.isDefault ? <Badge variant="outline">Default</Badge> : null}
					</span>
				) : null}
			</footer>

			{createDialogOpen ? (
				<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>New view</DialogTitle>
						</DialogHeader>
						<div className="py-2">
							<label htmlFor="create-view-name" className="text-xs text-basalt-muted-foreground">
								Name
							</label>
							<Input
								id="create-view-name"
								className="mt-1 w-full"
								value={newViewName}
								onChange={(e) => setNewViewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") void handleCreateView();
									if (e.key === "Escape") closeCreateDialog();
								}}
								placeholder="e.g. Engineering"
								autoFocus={true}
							/>
						</div>
						<div className="mt-4 flex items-center justify-end gap-2">
							<Button variant="ghost" size="sm" onClick={closeCreateDialog}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={() => void handleCreateView()}
								disabled={isSaving || !newViewName.trim()}
							>
								Create
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	);
}
