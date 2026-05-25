import type { DocumentVersion, Person, UpdateDocumentInput } from "@bogo/shared";
import { ArrowLeft, GitCompareArrows, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "../../lib/markdown.js";
import type { DocumentVM } from "../../viewmodels/document/use-document.js";
import { DocumentPersons } from "./DocumentPersons.js";
import { VersionDiff } from "./VersionDiff.js";

export function DocumentEditor({
	vm,
	allPersons,
	allPersonsLoading,
	allPersonsError,
	onBack,
}: {
	vm: DocumentVM;
	allPersons: Person[];
	allPersonsLoading?: boolean;
	allPersonsError?: Error | null;
	onBack: () => void;
}) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [eventDate, setEventDate] = useState("");
	const [dirty, setDirty] = useState(false);
	const [tab, setTab] = useState<"edit" | "preview">("edit");

	// biome-ignore lint/correctness/useExhaustiveDependencies: only sync from server when not dirty (prevents rollback from overwriting user draft)
	useEffect(() => {
		if (vm.document && !dirty) {
			setTitle(vm.document.title);
			setContent(vm.document.content);
			setEventDate(vm.document.eventDate ?? "");
		}
	}, [vm.document]);

	const handleTitleChange = useCallback((value: string) => {
		setTitle(value);
		setDirty(true);
	}, []);

	const handleContentChange = useCallback((value: string) => {
		setContent(value);
		setDirty(true);
	}, []);

	const handleEventDateChange = useCallback(
		(value: string) => {
			setEventDate(value);
			vm.update({ eventDate: value || null });
		},
		[vm],
	);

	const handleSave = useCallback(() => {
		if (!dirty) {
			return;
		}
		const input: UpdateDocumentInput = {};
		if (title !== vm.document?.title) {
			input.title = title;
		}
		if (content !== vm.document?.content) {
			input.content = content;
		}
		if (Object.keys(input).length > 0) {
			vm.update(input, { onSuccess: () => setDirty(false) });
		}
	}, [dirty, title, content, vm]);

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
				Failed to load document: {vm.error.message}
			</div>
		);
	}

	if (!vm.document) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				Document not found
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Back to documents"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<input
					type="text"
					value={title}
					onChange={(e) => handleTitleChange(e.target.value)}
					className="flex-1 bg-transparent text-base font-semibold text-foreground outline-none border-b border-transparent focus:border-primary transition-colors"
					aria-label="Document title"
				/>
				<button
					type="button"
					onClick={handleSave}
					disabled={!dirty || vm.isUpdating}
					className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					aria-label="Save document"
				>
					{vm.isUpdating ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Save className="h-4 w-4" />
					)}
					Save
				</button>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>v{vm.document.version}</span>
				<input
					type="date"
					value={eventDate}
					onChange={(e) => handleEventDateChange(e.target.value)}
					className="bg-transparent border border-border rounded px-2 py-0.5 text-xs text-muted-foreground focus:border-primary outline-none transition-colors"
					aria-label="Event date"
				/>
				{dirty && <span className="text-amber-400">Unsaved changes</span>}
			</div>

			<div className="flex items-center gap-1 border-b border-border">
				<button
					type="button"
					onClick={() => setTab("edit")}
					className={`px-3 py-1.5 text-xs font-medium transition-colors ${
						tab === "edit"
							? "text-primary border-b-2 border-primary"
							: "text-muted-foreground hover:text-foreground"
					}`}
					aria-label="Edit tab"
				>
					Edit
				</button>
				<button
					type="button"
					onClick={() => setTab("preview")}
					className={`px-3 py-1.5 text-xs font-medium transition-colors ${
						tab === "preview"
							? "text-primary border-b-2 border-primary"
							: "text-muted-foreground hover:text-foreground"
					}`}
					aria-label="Preview tab"
				>
					Preview
				</button>
			</div>

			<div className={tab !== "edit" ? "hidden" : ""}>
				<textarea
					value={content}
					onChange={(e) => handleContentChange(e.target.value)}
					className="w-full min-h-[400px] rounded-lg border border-border bg-card p-4 text-sm text-foreground font-mono outline-none focus:border-primary resize-y transition-colors"
					placeholder="Write document content..."
					aria-label="Document content"
				/>
			</div>
			<div className={tab !== "preview" ? "hidden" : ""}>
				<MarkdownPreview content={content} />
			</div>

			<DocumentPersons
				persons={vm.persons}
				allPersons={allPersons}
				isLoading={vm.isLoadingPersons}
				personsError={vm.personsError}
				allPersonsLoading={allPersonsLoading ?? false}
				allPersonsError={allPersonsError ?? null}
				onAdd={vm.addPerson}
				isAdding={vm.isAddingPerson}
				onRemove={vm.removePerson}
				isRemoving={vm.isRemovingPerson}
			/>

			{vm.versions.length > 0 && (
				<VersionList versions={vm.versions} currentVersion={vm.document.version} />
			)}
		</div>
	);
}

function MarkdownPreview({ content }: { content: string }) {
	const html = useMemo(() => renderMarkdown(content), [content]);

	return (
		<div
			className="w-full min-h-[400px] rounded-lg border border-border bg-card p-4 text-sm text-foreground prose prose-invert max-w-none"
			aria-label="Markdown preview"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown from user input only
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

function VersionList({
	versions,
	currentVersion,
}: {
	versions: DocumentVersion[];
	currentVersion: number;
}) {
	const [diffIndex, setDiffIndex] = useState<number | null>(null);

	const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);

	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold text-foreground">Version History</h3>
			<div className="space-y-1">
				{sorted.map((v, i) => (
					<div
						key={v.id}
						className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs ${
							v.version === currentVersion ? "bg-primary/10 text-primary" : "text-muted-foreground"
						}`}
					>
						<span className="font-medium">v{v.version}</span>
						<span className="flex-1 truncate">{v.title}</span>
						<span>{v.createdAt}</span>
						{i < sorted.length - 1 && (
							<button
								type="button"
								onClick={() => setDiffIndex(diffIndex === i ? null : i)}
								className={`shrink-0 transition-colors ${
									diffIndex === i ? "text-primary" : "text-muted-foreground hover:text-foreground"
								}`}
								aria-label={`Compare v${sorted[i + 1].version} to v${v.version}`}
							>
								<GitCompareArrows className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				))}
			</div>
			{diffIndex !== null && diffIndex < sorted.length - 1 && (
				<VersionDiff oldVersion={sorted[diffIndex + 1]} newVersion={sorted[diffIndex]} />
			)}
		</div>
	);
}
