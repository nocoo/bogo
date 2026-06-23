import type { DocumentVersion } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { api } from "../../lib/api/index.js";
import { documentKeys } from "../../models/document.model.js";

const LazyMultiFileDiff = lazy(() =>
	import("@pierre/diffs/react").then((m) => ({ default: m.MultiFileDiff })),
);

/**
 * Diff view between two document versions. The list endpoint
 * `GET /documents/:id/versions` is a summary (no `content`), so this
 * component fetches each version's body on demand via
 * `GET /documents/:id/versions/:version`. Pass version numbers, not
 * full DocumentVersion objects.
 */
export function VersionDiff({
	wid,
	documentId,
	oldVersion,
	newVersion,
}: {
	wid: string;
	documentId: string;
	oldVersion: number;
	newVersion: number;
}) {
	const oldQ = useQuery({
		queryKey: documentKeys.version(wid, documentId, oldVersion),
		queryFn: () => api.documents.getVersion(wid, documentId, oldVersion),
	});
	const newQ = useQuery({
		queryKey: documentKeys.version(wid, documentId, newVersion),
		queryFn: () => api.documents.getVersion(wid, documentId, newVersion),
	});

	if (oldQ.isLoading || newQ.isLoading) {
		return (
			<div
				className="flex items-center justify-center py-8"
				role="status"
				aria-label="Loading diff"
			>
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (oldQ.error || newQ.error || !oldQ.data || !newQ.data) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
				Failed to load version content.
			</div>
		);
	}

	const oldV: DocumentVersion = oldQ.data;
	const newV: DocumentVersion = newQ.data;

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>
					Comparing v{oldV.version} → v{newV.version}
				</span>
			</div>
			{oldV.title !== newV.title && (
				<div className="rounded-md border border-border p-2 text-xs">
					<span className="text-muted-foreground">Title: </span>
					<span className="line-through text-red-400">{oldV.title}</span>
					<span className="mx-1">→</span>
					<span className="text-green-400">{newV.title}</span>
				</div>
			)}
			<Suspense
				fallback={
					<div
						className="flex items-center justify-center py-8"
						role="status"
						aria-label="Loading diff"
					>
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				}
			>
				<LazyMultiFileDiff
					oldFile={{ name: "document.md", contents: oldV.content, lang: "markdown" }}
					newFile={{ name: "document.md", contents: newV.content, lang: "markdown" }}
					options={{
						diffStyle: "unified",
						theme: { dark: "github-dark", light: "github-light" },
					}}
				/>
			</Suspense>
		</div>
	);
}
