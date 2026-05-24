import type { DocumentVersion } from "@bogo/shared";
import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";

const LazyMultiFileDiff = lazy(() =>
	import("@pierre/diffs/react").then((m) => ({ default: m.MultiFileDiff })),
);

export function VersionDiff({
	oldVersion,
	newVersion,
}: {
	oldVersion: DocumentVersion;
	newVersion: DocumentVersion;
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>
					Comparing v{oldVersion.version} → v{newVersion.version}
				</span>
			</div>
			{oldVersion.title !== newVersion.title && (
				<div className="rounded-md border border-border p-2 text-xs">
					<span className="text-muted-foreground">Title: </span>
					<span className="line-through text-red-400">{oldVersion.title}</span>
					<span className="mx-1">→</span>
					<span className="text-green-400">{newVersion.title}</span>
				</div>
			)}
			<Suspense
				fallback={
					<div className="flex items-center justify-center py-8" aria-label="Loading diff">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				}
			>
				<LazyMultiFileDiff
					oldFile={{ name: "document.md", contents: oldVersion.content, lang: "markdown" }}
					newFile={{ name: "document.md", contents: newVersion.content, lang: "markdown" }}
					options={{
						diffStyle: "unified",
						theme: { dark: "github-dark", light: "github-light" },
					}}
				/>
			</Suspense>
		</div>
	);
}
