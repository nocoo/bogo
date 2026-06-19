import type { DocumentType, DocumentVersion, Person, UpdateDocumentInput } from "@bogo/shared";
import { ArrowLeft, GitCompareArrows, Loader2, Pencil, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "../../lib/markdown.js";
import type { DocumentVM } from "../../viewmodels/document/use-document.js";
import { TagPicker } from "../TagPicker.js";
import { DocTypePicker } from "./DocTypePicker.js";
import { DocumentPersons } from "./DocumentPersons.js";
import { VersionDiff } from "./VersionDiff.js";

export function DocumentEditor({
	vm,
	allPersons,
	allPersonsLoading,
	allPersonsError,
	docTypes = [],
	onBack,
}: {
	vm: DocumentVM;
	allPersons: Person[];
	allPersonsLoading?: boolean;
	allPersonsError?: Error | null;
	docTypes?: DocumentType[];
	onBack: () => void;
}) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [dirty, setDirty] = useState(false);

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

	const handleTypeChange = useCallback(
		(typeId: string | null) => {
			vm.update({ typeId });
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
		<div className="flex h-full overflow-hidden">
			{/* Main column — header strip + editor/preview */}
			<div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-2">
				{/* Back link — own row, low-weight */}
				<button
					type="button"
					onClick={onBack}
					className="shrink-0 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground transition-colors -ml-0.5"
					aria-label="Back to documents"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					All documents
				</button>

				{/* Title row: title fills width, save floats right */}
				<div className="shrink-0 flex items-center gap-3">
					<TitleField title={title} onChange={handleTitleChange} />
					<button
						type="button"
						onClick={handleSave}
						disabled={!dirty || vm.isUpdating}
						className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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

				{/* Status row: dirty indicator + version + updated time */}
				<div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
					<DirtyChip dirty={dirty} />
					<span>v{vm.document.version}</span>
					<span aria-hidden="true">·</span>
					<span>updated {formatRelative(vm.document.updatedAt)}</span>
				</div>

				{/* Editor + Preview */}
				<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
					<div className="flex flex-col min-h-0">
						<span className="shrink-0 mb-1 text-xs font-medium text-muted-foreground">Edit</span>
						<textarea
							value={content}
							onChange={(e) => handleContentChange(e.target.value)}
							className="flex-1 min-h-0 w-full rounded-lg border border-border bg-secondary p-4 text-sm text-foreground font-mono outline-none focus:border-primary resize-none transition-colors"
							placeholder="Write document content..."
							aria-label="Document content"
						/>
					</div>
					<div className="flex flex-col min-h-0">
						<span className="shrink-0 mb-1 text-xs font-medium text-muted-foreground">Preview</span>
						<MarkdownPreview content={content} />
					</div>
				</div>
			</div>

			{/* Right sidebar — metadata + history (always shown on xl+) */}
			<aside className="hidden xl:flex w-80 shrink-0 flex-col gap-5 border-l border-border pl-5 ml-5 overflow-y-auto">
				<SidebarSection label="Type">
					<DocTypePicker
						types={docTypes}
						value={vm.document.typeId}
						onChange={handleTypeChange}
						disabled={vm.isUpdating}
					/>
				</SidebarSection>

				<SidebarSection label="Tags">
					<TagPicker scope="document" entityId={vm.document.id} assignedTags={vm.document.tags} />
				</SidebarSection>

				<SidebarSection label="People">
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
						compact={true}
					/>
				</SidebarSection>

				<SidebarSection label="Event date">
					<input
						id="event-date"
						type="date"
						value={eventDate}
						onChange={(e) => handleEventDateChange(e.target.value)}
						className="h-8 w-full rounded-md border border-border bg-secondary px-2.5 text-sm text-foreground focus:border-primary outline-none transition-colors"
						aria-label="Event date"
					/>
				</SidebarSection>

				{vm.versions.length > 0 && (
					<SidebarSection label="History">
						<VersionList versions={vm.versions} currentVersion={vm.document.version} />
					</SidebarSection>
				)}
			</aside>
		</div>
	);
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{label}
			</h3>
			{children}
		</section>
	);
}

function DirtyChip({ dirty }: { dirty: boolean }) {
	if (!dirty) {
		return (
			<span className="inline-flex items-center gap-1.5 text-muted-foreground">
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
				All changes saved
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 text-amber-500 font-medium">
			<span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
			Unsaved changes
		</span>
	);
}

function TitleField({ title, onChange }: { title: string; onChange: (value: string) => void }) {
	return (
		<div className="group relative flex-1 min-w-0 flex items-center gap-2">
			<input
				type="text"
				value={title}
				onChange={(e) => onChange(e.target.value)}
				className="flex-1 min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none rounded-md px-1.5 -ml-1.5 hover:bg-accent/60 focus:bg-accent/60 transition-colors"
				aria-label="Document title"
				placeholder="Untitled document"
			/>
			<Pencil
				className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
				strokeWidth={1.6}
				aria-hidden="true"
			/>
		</div>
	);
}

function MarkdownPreview({ content }: { content: string }) {
	const html = useMemo(() => renderMarkdown(content), [content]);

	return (
		<article
			className="markdown-surface flex-1 min-h-0 w-full"
			aria-label="Markdown preview"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown from user input only
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

function formatRelative(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) {
		return "just now";
	}
	if (diffMin < 60) {
		return `${diffMin}m ago`;
	}
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) {
		return `${diffHr}h ago`;
	}
	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 7) {
		return `${diffDay}d ago`;
	}
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
			<h3 className="sr-only">Version History</h3>
			<div className="space-y-0.5">
				{sorted.map((v, i) => (
					<div
						key={v.id}
						className={`grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
							v.version === currentVersion ? "bg-primary/10 text-primary" : "text-muted-foreground"
						}`}
					>
						<span className="font-semibold">v{v.version}</span>
						<span className="truncate">{v.title}</span>
						<span className="text-[11px]">{formatRelative(v.createdAt)}</span>
						{i < sorted.length - 1 ? (
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
						) : (
							<span className="w-3.5" aria-hidden="true" />
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
