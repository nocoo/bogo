import type { Document } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useWorkspaceContext } from "@/contexts/workspace-context.js";
import { personModel } from "@/models/person.model.js";
import { useDocTypes } from "@/viewmodels/document/use-doc-types.js";
import { TagBadge } from "../TagBadge.js";

export function PersonDocTimeline({
	personId,
	onClose,
}: {
	personId: string;
	onClose: () => void;
}) {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const navigate = useNavigate();

	const { data: documents, isLoading } = useQuery(personModel.documentsQueryOptions(wid, personId));
	const docTypesVm = useDocTypes();

	const typeById = useMemo(() => {
		const map = new Map<string, { name: string; color: string | null }>();
		for (const t of docTypesVm.types) map.set(t.id, { name: t.name, color: t.color ?? null });
		return map;
	}, [docTypesVm.types]);

	const { undated, dated } = useMemo(() => {
		if (!documents) {
			return { undated: [] as Document[], dated: [] as Document[] };
		}
		const undated: Document[] = [];
		const dated: Document[] = [];
		for (const doc of documents) {
			if (doc.eventDate) {
				dated.push(doc);
			} else {
				undated.push(doc);
			}
		}
		return { undated, dated };
	}, [documents]);

	return (
		<div className="w-72 rounded-xl border border-border bg-secondary p-4 shadow-lg">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-foreground">Documents</h3>
				<button
					type="button"
					onClick={onClose}
					className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close timeline"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</button>
			</div>

			<div className="max-h-[480px] overflow-y-auto -mr-2 pr-2">
				{isLoading && (
					<div className="flex justify-center py-6">
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && documents?.length === 0 && (
					<p className="text-sm text-muted-foreground text-center py-6">No documents</p>
				)}

				{!isLoading && documents && documents.length > 0 && (
					<div className="space-y-2">
						{undated.length > 0 && (
							<div className="space-y-2">
								<SectionLabel label="No date" />
								{undated.map((doc) => (
									<DocCard
										key={doc.id}
										doc={doc}
										type={doc.typeId ? typeById.get(doc.typeId) : undefined}
										onClick={() => navigate(`/documents/${doc.id}`)}
									/>
								))}
							</div>
						)}

						{dated.length > 0 && (
							<div className="space-y-2">
								{dated.map((doc, i) => (
									<div key={doc.id} className="space-y-2">
										{(i === 0 || dated[i - 1].eventDate !== doc.eventDate) && (
											<SectionLabel label={doc.eventDate ?? ""} />
										)}
										<DocCard
											doc={doc}
											type={doc.typeId ? typeById.get(doc.typeId) : undefined}
											onClick={() => navigate(`/documents/${doc.id}`)}
										/>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function SectionLabel({ label }: { label: string }) {
	return (
		<div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground pt-1">
			{label}
		</div>
	);
}

function DocCard({
	doc,
	type,
	onClick,
}: {
	doc: Document;
	type?: { name: string; color: string | null };
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group w-full text-left rounded-md border border-border bg-background px-3 py-2.5 hover:border-primary/40 hover:bg-accent/40 transition-colors space-y-1.5"
		>
			<h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
				{doc.title}
			</h4>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
				{type && (
					<span className="inline-flex items-center gap-1">
						<span
							className="inline-block h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor: type.color ?? "currentColor" }}
							aria-hidden="true"
						/>
						{type.name}
					</span>
				)}
				<span>v{doc.version}</span>
				{doc.tags.length > 0 && (
					<span className="flex items-center gap-1 flex-wrap">
						{doc.tags.map((tag) => (
							<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
						))}
					</span>
				)}
			</div>
		</button>
	);
}
