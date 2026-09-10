import type { DocumentSummary, Tag } from "@bogo/shared";
import { Badge, Button, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { FileText, Filter, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { DocumentFilters, EMPTY_FILTERS } from "../components/DocumentFilters.js";
import { PersonAvatarCluster } from "../components/person/PersonAvatarCluster.js";
import { TagBadge } from "../components/TagBadge.js";
import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { cn } from "../lib/utils.js";
import { tagModel } from "../models/tag.model.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";
import { useDocuments } from "../viewmodels/document/use-documents.js";
import { usePersonList } from "../viewmodels/person/use-person-list.js";

export function DocumentsPage() {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const vm = useDocuments();
	const docTypesVm = useDocTypes();
	const personListVM = usePersonList();
	const { data: allTags } = useQuery(tagModel.queryOptions(wid, "document"));
	const [showCreate, setShowCreate] = useState(false);
	const [filters, setFilters] = useState(EMPTY_FILTERS);
	const [filtersOpen, setFiltersOpen] = useState(false);

	const activeFilterCount = useMemo(() => {
		let n = 0;
		if (filters.keyword.trim() !== "") n++;
		if (filters.typeId !== "all") n++;
		if (filters.dateFrom || filters.dateTo) n++;
		if (filters.tagIds.length > 0) n += filters.tagIds.length;
		if (filters.personIds.length > 0) n += filters.personIds.length;
		return n;
	}, [filters]);

	const filteredDocs = useMemo(() => applyFilters(vm.documents, filters), [vm.documents, filters]);
	const personsById = useMemo(
		() => new Map(personListVM.persons.map((p) => [p.id, p])),
		[personListVM.persons],
	);

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-basalt-muted-foreground">
				Select a workspace to manage documents
			</div>
		);
	}

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg bg-basalt-destructive/10 p-4 text-sm text-basalt-destructive">
				Failed to load documents: {vm.error.message}
			</div>
		);
	}

	const hasActiveFilters =
		filters !== EMPTY_FILTERS && JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

	return (
		<div className="space-y-4">
			<PageHeader
				title="Documents"
				description="Manage notes, 1:1 records, architecture proposals, and promotion cases."
				actions={
					<>
						<Button
							variant="outline"
							onClick={() => setFiltersOpen((o) => !o)}
							className={cn(filtersOpen && "bg-basalt-accent text-basalt-accent-foreground")}
							aria-label="Filter documents"
						>
							<Filter className="h-4 w-4" strokeWidth={1.6} />
							Filters
							{activeFilterCount > 0 && (
								<Badge variant="blue" className="ml-1 px-1.5 text-[10px]">
									{activeFilterCount}
								</Badge>
							)}
						</Button>
						<Button
							onClick={() => setShowCreate(true)}
							disabled={showCreate}
							aria-label="Create document"
						>
							<Plus className="h-4 w-4" strokeWidth={2} />
							New Document
						</Button>
					</>
				}
			/>

			{showCreate && (
				<CreateDocumentForm
					onSubmit={(title, typeId) => {
						vm.create({ title, content: "", personIds: [], typeId });
						setShowCreate(false);
					}}
					onCancel={() => setShowCreate(false)}
					isCreating={vm.isCreating}
					docTypes={docTypesVm.types}
				/>
			)}

			{filtersOpen && (
				<DocumentFilters
					value={filters}
					onChange={setFilters}
					docTypes={docTypesVm.types}
					allTags={(allTags ?? []) as Tag[]}
					allPersons={personListVM.persons}
				/>
			)}

			{filteredDocs.length === 0 && !showCreate && (
				<div className="flex flex-col items-center justify-center py-12 text-basalt-muted-foreground">
					<FileText className="h-10 w-10 mb-3 opacity-50" />
					<p className="text-sm">
						{hasActiveFilters ? "No documents match your filters" : "No documents yet"}
					</p>
				</div>
			)}

			<div className="space-y-3">
				{filteredDocs.map((doc) => (
					<DocumentRow
						key={doc.id}
						doc={doc}
						typeName={docTypesVm.types.find((t) => t.id === doc.typeId)?.name ?? null}
						typeColor={docTypesVm.types.find((t) => t.id === doc.typeId)?.color ?? null}
						people={(doc.personIds ?? [])
							.map((id) => personsById.get(id))
							.filter((p): p is NonNullable<typeof p> => Boolean(p))}
						onRemove={vm.remove}
						isRemoving={vm.isRemoving}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Client-side filtering for the document list. The list payload already
 * carries everything we need (title, eventDate, typeId, tags, personIds);
 * this avoids a server round-trip for each filter change.
 */
export function applyFilters(docs: DocumentSummary[], f: typeof EMPTY_FILTERS): DocumentSummary[] {
	const kw = f.keyword.trim().toLowerCase();
	return docs.filter((d) => {
		if (kw && !d.title.toLowerCase().includes(kw)) return false;

		if (f.typeId === "none") {
			if (d.typeId !== null) return false;
		} else if (f.typeId !== "all") {
			if (d.typeId !== f.typeId) return false;
		}

		if (f.dateFrom && (!d.eventDate || d.eventDate < f.dateFrom)) return false;
		if (f.dateTo && (!d.eventDate || d.eventDate > f.dateTo)) return false;

		if (f.tagIds.length > 0) {
			const docTagIds = new Set(d.tags.map((t) => t.id));
			if (!f.tagIds.every((id) => docTagIds.has(id))) return false;
		}

		if (f.personIds.length > 0) {
			const docPersonIds = new Set(d.personIds ?? []);
			if (!f.personIds.every((id) => docPersonIds.has(id))) return false;
		}

		return true;
	});
}

function CreateDocumentForm({
	onSubmit,
	onCancel,
	isCreating,
	docTypes,
}: {
	onSubmit: (title: string, typeId?: string | null) => void;
	onCancel: () => void;
	isCreating: boolean;
	docTypes: { id: string; name: string; color: string | null }[];
}) {
	const [title, setTitle] = useState("");
	const [typeId, setTypeId] = useState<string>("");

	const handleSubmit = useCallback(() => {
		const trimmed = title.trim();
		if (!trimmed) {
			return;
		}
		onSubmit(trimmed, typeId || null);
	}, [title, typeId, onSubmit]);

	return (
		<LayerCard className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-basalt-foreground">New Document</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onCancel}
					className="h-7 w-7 text-basalt-muted-foreground hover:text-basalt-foreground"
					aria-label="Cancel create"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
			<div>
				<label htmlFor="doc-title" className="text-xs text-basalt-muted-foreground">
					Title
				</label>
				<Input
					id="doc-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Document title"
					className="mt-1 w-full"
					autoFocus={true}
				/>
			</div>
			{docTypes.length > 0 && (
				<div>
					<label htmlFor="doc-type-select" className="text-xs text-basalt-muted-foreground">
						Type
					</label>
					<select
						id="doc-type-select"
						value={typeId}
						onChange={(e) => setTypeId(e.target.value)}
						className="field-select mt-1 w-full"
					>
						<option value="">None</option>
						{docTypes.map((dt) => (
							<option key={dt.id} value={dt.id}>
								{dt.name}
							</option>
						))}
					</select>
				</div>
			)}
			<div className="flex items-center gap-2">
				<Button
					onClick={handleSubmit}
					disabled={!title.trim() || isCreating}
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

function DocumentRow({
	doc,
	typeName,
	typeColor,
	people,
	onRemove,
	isRemoving,
}: {
	doc: DocumentSummary;
	typeName: string | null;
	typeColor: string | null;
	people: { id: string; name: string; avatarUrl?: string | null }[];
	onRemove: (id: string) => void;
	isRemoving: boolean;
}) {
	return (
		<LayerCard className="group transition-colors hover:bg-basalt-secondary/80">
			<div className="flex items-center gap-3">
				<Link
					to={`/documents/${doc.id}`}
					className="flex flex-1 items-center gap-3 min-w-0"
					aria-label={`Open ${doc.title}`}
				>
					<div
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-basalt-muted/60 text-basalt-muted-foreground"
						aria-hidden="true"
					>
						<FileText className="h-4 w-4" strokeWidth={1.6} />
					</div>
					<div className="flex-1 min-w-0 space-y-1.5">
						<h3 className="text-sm font-semibold text-basalt-foreground line-clamp-2 leading-snug">
							{doc.title}
						</h3>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-basalt-muted-foreground">
							{typeName && (
								<span className="inline-flex items-center gap-1.5">
									<span
										className="inline-block h-2 w-2 rounded-full"
										style={{ backgroundColor: typeColor ?? "currentColor" }}
										aria-hidden="true"
									/>
									{typeName}
								</span>
							)}
							{doc.eventDate && (
								<span className="inline-flex items-center gap-1">{doc.eventDate}</span>
							)}
							<span className="inline-flex items-center gap-1">v{doc.version}</span>
							{doc.tags.length > 0 && (
								<span className="flex items-center gap-1.5 flex-wrap">
									{doc.tags.map((tag) => (
										<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
									))}
								</span>
							)}
						</div>
					</div>
				</Link>
				{people.length > 0 && (
					<span className="shrink-0">
						<span className="sr-only">People on {doc.title}</span>
						<PersonAvatarCluster people={people} max={4} size="sm" />
					</span>
				)}
				<Button
					variant="ghost"
					size="icon"
					onClick={() => onRemove(doc.id)}
					disabled={isRemoving}
					className="h-7 w-7 text-basalt-muted-foreground opacity-0 group-hover:opacity-100 hover:text-basalt-destructive disabled:opacity-50 transition-all"
					aria-label={`Delete ${doc.title}`}
				>
					{isRemoving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" strokeWidth={1.5} />
					)}
				</Button>
			</div>
		</LayerCard>
	);
}
