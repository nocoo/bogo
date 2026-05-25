import { useWorkspaceContext } from "@/contexts/workspace-context.js";
import { personModel } from "@/models/person.model.js";
import type { Document } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";

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

	const { undated, dated } = useMemo(() => {
		if (!documents) {
			return { undated: [], dated: [] };
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
		<div className="w-64 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
			<div className="flex items-center justify-between px-3 py-2 border-b border-border">
				<h3 className="text-xs font-semibold text-foreground">Documents</h3>
				<button
					type="button"
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close timeline"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>

			<div className="max-h-[400px] overflow-y-auto p-3">
				{isLoading && (
					<div className="flex justify-center py-4">
						<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
					</div>
				)}

				{!isLoading && documents?.length === 0 && (
					<p className="text-xs text-muted-foreground text-center py-4">No documents</p>
				)}

				{!isLoading && documents && documents.length > 0 && (
					<div className="relative pl-4">
						<div className="absolute left-1 top-1 bottom-1 w-px bg-border" />

						{undated.map((doc) => (
							<TimelineItem
								key={doc.id}
								doc={doc}
								onClick={() => navigate(`/documents/${doc.id}`)}
							/>
						))}

						{undated.length > 0 && dated.length > 0 && <DateSeparator />}

						{dated.map((doc, i) => (
							<div key={doc.id}>
								{(i === 0 || dated[i - 1].eventDate !== doc.eventDate) && (
									<DateSeparator date={doc.eventDate ?? undefined} />
								)}
								<TimelineItem doc={doc} onClick={() => navigate(`/documents/${doc.id}`)} />
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function TimelineItem({ doc, onClick }: { doc: Document; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="relative flex items-start gap-2 w-full text-left py-1.5 group"
		>
			<div className="absolute -left-4 top-2.5 w-2 h-2 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
			<span className="text-xs text-foreground group-hover:text-primary truncate transition-colors">
				{doc.title}
			</span>
		</button>
	);
}

function DateSeparator({ date }: { date?: string }) {
	return (
		<div className="flex items-center gap-2 py-1.5">
			<div className="flex-1 border-t border-border/60" />
			{date && <span className="text-[10px] text-muted-foreground shrink-0">{date}</span>}
			<div className="flex-1 border-t border-border/60" />
		</div>
	);
}
