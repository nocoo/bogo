import type { ColumnKey, ViewFilter, ViewSort } from "@bogo/shared";
import { DEFAULT_TABLE_VIEW_COLUMNS, DEFAULT_TABLE_VIEW_NAME } from "@bogo/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { EditPersonPanel } from "@/components/person/EditPersonPanel";
import { TagBadge } from "@/components/TagBadge";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs";
import { useFieldValues } from "@/viewmodels/field/use-field-values";
import { usePersonList } from "@/viewmodels/person/use-person-list";
import { builtinColumnMetas, resolveColumnMeta } from "@/viewmodels/table/column-catalog";
import { useTableGrid } from "@/viewmodels/table/use-table-grid";
import { useTableViews } from "@/viewmodels/table/use-table-views";

export function TablePage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const viewParam = searchParams.get("view");
	const { workspaceId } = useWorkspaceContext();
	const navigate = useNavigate();
	const personList = usePersonList();
	const fieldDefsVm = useFieldDefs();

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

	const { grid, defs, isLoading: gridLoading } = useTableGrid(activeView);

	const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
	const selectedPerson = useMemo(
		() => personList.persons.find((p) => p.id === selectedPersonId) ?? null,
		[personList.persons, selectedPersonId],
	);
	const fieldValuesVm = useFieldValues(selectedPersonId ?? "");

	const [configOpen, setConfigOpen] = useState(false);
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
			<div className="p-6 text-muted-foreground">Select a workspace to open the people table.</div>
		);
	}

	const loading = viewsLoading || gridLoading;

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
			<header className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">View</span>
					<select
						className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
				</label>
				<button
					type="button"
					className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
					onClick={() => setConfigOpen((o) => !o)}
				>
					Configure columns
				</button>
				<button
					type="button"
					className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
					onClick={handlePromoteDefault}
					disabled={!activeView || activeView.isDefault || isSaving}
				>
					Set as default
				</button>
				<button
					type="button"
					className="rounded-md border border-border px-3 py-1.5 text-sm text-destructive hover:bg-accent"
					onClick={handleDeleteView}
					disabled={!activeView || activeView.isDefault || isSaving}
				>
					Delete view
				</button>
				<div className="ml-auto flex items-center gap-2">
					<input
						className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
						placeholder="New view name"
						value={newViewName}
						onChange={(e) => setNewViewName(e.target.value)}
					/>
					<button
						type="button"
						className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
						onClick={handleCreateView}
						disabled={isSaving}
					>
						New view
					</button>
				</div>
			</header>

			{configOpen && (
				<section className="rounded-lg border border-border bg-card p-4">
					<h2 className="mb-2 text-sm font-medium">Columns</h2>
					<ul className="mb-3 max-h-48 space-y-1 overflow-auto text-sm">
						{availableColumns.map((col) => {
							const checked = draftColumns.includes(col.key);
							const locked = col.key === "builtin:name";
							return (
								<li key={col.key}>
									<label className="flex items-center gap-2">
										<input
											type="checkbox"
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
										<span>{col.label}</span>
										<span className="text-muted-foreground text-xs">{col.key}</span>
									</label>
								</li>
							);
						})}
					</ul>
					<button
						type="button"
						className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
						onClick={saveColumns}
						disabled={isSaving}
					>
						Save columns
					</button>
				</section>
			)}

			<section className="rounded-lg border border-border bg-card p-4">
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<h2 className="text-sm font-medium">Filters</h2>
					<button
						type="button"
						className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
						onClick={() =>
							setFilterDraft((d) => [...d, { key: "builtin:name", op: "contains", value: "" }])
						}
					>
						Add filter
					</button>
					<button
						type="button"
						className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
						onClick={saveFilters}
						disabled={isSaving}
					>
						Save filters
					</button>
				</div>
				<ul className="space-y-2">
					{filterDraft.map((f, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: draft filter rows have no stable id
						<li key={`filter-row-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
							<select
								className="rounded border border-border bg-background px-1 py-1"
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
								className="rounded border border-border bg-background px-1 py-1"
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
															op === "is_empty" || op === "is_not_empty" ? null : (x.value ?? ""),
													}
												: x,
										),
									);
								}}
							>
								{(
									[
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
									] as const
								).map((op) => (
									<option key={op} value={op}>
										{op}
									</option>
								))}
							</select>
							{f.op !== "is_empty" && f.op !== "is_not_empty" && f.op !== "in" && (
								<input
									className="rounded border border-border bg-background px-2 py-1"
									value={typeof f.value === "string" ? f.value : ""}
									onChange={(e) => {
										const value = e.target.value;
										setFilterDraft((d) => d.map((x, j) => (j === i ? { ...x, value } : x)));
									}}
								/>
							)}
							{f.op === "in" && (
								<input
									className="rounded border border-border bg-background px-2 py-1"
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
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setFilterDraft((d) => d.filter((_, j) => j !== i))}
							>
								Remove
							</button>
						</li>
					))}
				</ul>
			</section>

			<div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
				{loading && <p className="p-4 text-sm text-muted-foreground">Loading table…</p>}
				{!loading && grid && grid.total === 0 && (
					<div className="p-6 text-sm text-muted-foreground">
						No people yet.{" "}
						<button
							type="button"
							className="text-primary underline"
							onClick={() => navigate("/people")}
						>
							Go to People
						</button>
					</div>
				)}
				{!loading && grid && grid.total > 0 && (
					<table className="w-full min-w-max border-collapse text-sm">
						<thead className="sticky top-0 bg-muted/80 backdrop-blur">
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
										<th
											key={col.key}
											scope="col"
											aria-sort={col.sortable ? ariaSort : undefined}
											className="border-b border-border px-3 py-2 text-left font-medium"
										>
											{col.sortable ? (
												<button
													type="button"
													className="inline-flex items-center gap-1 hover:underline"
													onClick={() => handleSortClick(col.key, true)}
												>
													{col.label}
													{sort?.key === col.key ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
												</button>
											) : (
												col.label
											)}
										</th>
									);
								})}
								<th scope="col" className="border-b border-border px-3 py-2 text-left">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{grid.rows.map((row) => (
								<tr
									key={row.person.id}
									className="hover:bg-accent/40 cursor-pointer"
									onClick={() => setSelectedPersonId(row.person.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter") setSelectedPersonId(row.person.id);
									}}
								>
									{columnMetas.map((col) => {
										const cell = row.cells[col.key];
										return (
											<td
												key={col.key}
												className={cn(
													"border-b border-border px-3 py-2",
													cell?.isDefault && "text-muted-foreground italic",
												)}
											>
												{col.kind === "tags" && cell?.tags ? (
													<span className="flex flex-wrap gap-1">
														{cell.tags.map((t) => (
															<TagBadge key={t.id} name={t.name} color={t.color} />
														))}
														{cell.tags.length === 0 ? "—" : null}
													</span>
												) : (
													(cell?.display ?? "—")
												)}
											</td>
										);
									})}
									<td className="border-b border-border px-3 py-2">
										<button
											type="button"
											className="text-primary text-xs underline"
											onClick={(e) => {
												e.stopPropagation();
												setSelectedPersonId(row.person.id);
											}}
										>
											Open
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<footer className="text-xs text-muted-foreground">
				{grid ? `${grid.filteredCount} of ${grid.total} people` : null}
				{grid?.skippedSort ? " · sort column unavailable" : ""}
				{grid && grid.skippedFilters > 0 ? ` · ${grid.skippedFilters} filter(s) skipped` : ""}
				{activeView ? ` · view: ${activeView.name || DEFAULT_TABLE_VIEW_NAME}` : ""}
			</footer>

			{selectedPerson && (
				<EditPersonPanel
					person={selectedPerson}
					persons={personList.persons}
					onUpdate={personList.update}
					onMove={personList.move}
					onRemove={(id) => {
						personList.remove(id);
						setSelectedPersonId(null);
					}}
					onClose={() => setSelectedPersonId(null)}
					isRemoving={personList.isRemoving}
					fieldDefs={fieldDefsVm.defs}
					fieldValuesVm={fieldValuesVm}
				/>
			)}
		</div>
	);
}
