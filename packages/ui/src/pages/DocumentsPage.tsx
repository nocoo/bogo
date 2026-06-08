import type { Document } from "@bogo/shared";
import { FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router";
import { TagBadge } from "../components/TagBadge.js";
import { TagFilter } from "../components/TagFilter.js";
import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";
import { useDocuments } from "../viewmodels/document/use-documents.js";

export function DocumentsPage() {
	const { workspaceId } = useWorkspaceContext();
	const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
	const vm = useDocuments(filterTagIds.length > 0 ? filterTagIds : undefined);
	const docTypesVm = useDocTypes();
	const [showCreate, setShowCreate] = useState(false);

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				Select a workspace to manage documents
			</div>
		);
	}

	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
				Failed to load documents: {vm.error.message}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-foreground">Documents</h2>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					disabled={showCreate}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					aria-label="Create document"
				>
					<Plus className="h-4 w-4" strokeWidth={2} />
					New Document
				</button>
			</div>

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

			<TagFilter scope="document" selected={filterTagIds} onChange={setFilterTagIds} />

			{vm.documents.length === 0 && !showCreate && (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<FileText className="h-10 w-10 mb-3 opacity-50" />
					<p className="text-sm">No documents yet</p>
				</div>
			)}

			<div className="space-y-3">
				{vm.documents.map((doc) => (
					<DocumentRow
						key={doc.id}
						doc={doc}
						typeName={docTypesVm.types.find((t) => t.id === doc.typeId)?.name ?? null}
						typeColor={docTypesVm.types.find((t) => t.id === doc.typeId)?.color ?? null}
						onRemove={vm.remove}
						isRemoving={vm.isRemoving}
					/>
				))}
			</div>
		</div>
	);
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
		<div className="rounded-lg border border-border bg-card p-4 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-foreground">New Document</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground hover:text-foreground"
					aria-label="Cancel create"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div>
				<label htmlFor="doc-title" className="text-xs text-muted-foreground">
					Title
				</label>
				<input
					id="doc-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Document title"
					className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
					// biome-ignore lint/a11y/noAutofocus: intentional focus on form open
					autoFocus={true}
				/>
			</div>
			{docTypes.length > 0 && (
				<div>
					<label htmlFor="doc-type-select" className="text-xs text-muted-foreground">
						Type
					</label>
					<select
						id="doc-type-select"
						value={typeId}
						onChange={(e) => setTypeId(e.target.value)}
						className="mt-1 w-full rounded-md border border-border bg-secondary pl-3 pr-8 py-2 text-sm text-foreground outline-none focus:border-primary"
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
				<button
					type="button"
					onClick={handleSubmit}
					disabled={!title.trim() || isCreating}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
					className="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

function DocumentRow({
	doc,
	typeName,
	typeColor,
	onRemove,
	isRemoving,
}: {
	doc: Document;
	typeName: string | null;
	typeColor: string | null;
	onRemove: (id: string) => void;
	isRemoving: boolean;
}) {
	return (
		<div className="group rounded-xl border border-border bg-secondary p-4 shadow-sm hover:border-primary/40 transition-colors">
			<div className="flex items-start gap-3">
				<Link
					to={`/documents/${doc.id}`}
					className="flex flex-1 items-start gap-3 min-w-0"
					aria-label={`Open ${doc.title}`}
				>
					<FileText className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" strokeWidth={1.6} />
					<div className="flex-1 min-w-0 space-y-2">
						<h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
							{doc.title}
						</h3>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
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
				<button
					type="button"
					onClick={() => onRemove(doc.id)}
					disabled={isRemoving}
					className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-red-500 disabled:opacity-50 transition-all"
					aria-label={`Delete ${doc.title}`}
				>
					{isRemoving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Trash2 className="h-4 w-4" strokeWidth={1.5} />
					)}
				</button>
			</div>
		</div>
	);
}
