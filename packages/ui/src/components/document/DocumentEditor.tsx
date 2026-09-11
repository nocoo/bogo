import type {
	DocumentType,
	DocumentVersionSummary,
	Person,
	UpdateDocumentInput,
} from "@bogo/shared";
import { Button, Input, LayerCard } from "@nocoo/basalt";
import { InputArea } from "@nocoo/basalt/components/input-area";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { GitCompareArrows, Loader2, Pencil, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { renderMarkdown } from "../../lib/markdown.js";
import type { DocumentVM } from "../../viewmodels/document/use-document.js";
import { PageBackLink } from "../layout/PageBackLink.js";
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
	}, [vm.document, dirty]);

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
				<Loader2 className="h-6 w-6 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-lg bg-basalt-destructive/10 p-4 text-sm text-basalt-danger">
				Failed to load document: {vm.error.message}
			</div>
		);
	}

	if (!vm.document) {
		return (
			<div className="flex items-center justify-center py-12 text-basalt-muted-foreground">
				Document not found
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				title={<TitleField title={title} onChange={handleTitleChange} />}
				description={
					<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
						<DirtyChip dirty={dirty} />
						<span>v{vm.document.version}</span>
						<span>Updated {formatRelative(vm.document.updatedAt)}</span>
					</span>
				}
				actions={
					<>
						<PageBackLink onClick={onBack} ariaLabel="Back to documents">
							Documents
						</PageBackLink>
						<Button
							onClick={handleSave}
							disabled={!dirty || !title.trim() || vm.isUpdating}
							loading={vm.isUpdating}
							aria-label="Save document"
						>
							<Save className="h-4 w-4" strokeWidth={1.5} />
							Save
						</Button>
					</>
				}
			/>
			<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
				<div className="grid min-w-0 gap-4 lg:grid-cols-2">
					<LayerCard padding="none" className="min-w-0 overflow-hidden">
						<div className="border-b border-basalt-border/60 px-4 py-3 text-xs font-medium text-basalt-muted-foreground">
							Markdown
						</div>
						<InputArea
							value={content}
							onChange={(e) => handleContentChange(e.target.value)}
							className="block h-[60vh] min-h-72 w-full resize-y rounded-none border-0 p-4 font-mono text-sm leading-relaxed shadow-none"
							placeholder="Write document content..."
							aria-label="Document content"
						/>
					</LayerCard>
					<LayerCard padding="none" className="min-w-0 overflow-hidden">
						<div className="border-b border-basalt-border/60 px-4 py-3 text-xs font-medium text-basalt-muted-foreground">
							Preview
						</div>
						<MarkdownPreview content={content} />
					</LayerCard>
				</div>
				<LayerCard className="min-w-0 space-y-5" role="complementary" aria-label="Document details">
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
						<Input
							id="event-date"
							type="date"
							value={eventDate}
							onChange={(e) => handleEventDateChange(e.target.value)}
							className="w-full"
							aria-label="Event date"
						/>
					</SidebarSection>

					{vm.versions.length > 0 && (
						<SidebarSection label="History">
							<VersionList
								wid={vm.document.workspaceId}
								documentId={vm.document.id}
								versions={vm.versions}
								currentVersion={vm.document.version}
							/>
						</SidebarSection>
					)}
				</LayerCard>
			</div>
		</div>
	);
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-[11px] font-medium uppercase tracking-wider text-basalt-muted-foreground">
				{label}
			</h3>
			{children}
		</section>
	);
}

function DirtyChip({ dirty }: { dirty: boolean }) {
	if (!dirty) {
		return (
			<span className="inline-flex items-center gap-1.5 text-basalt-muted-foreground">
				<span
					className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
					aria-hidden="true"
				/>
				All changes saved
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 text-basalt-warning font-medium">
			<span className="h-1.5 w-1.5 rounded-full bg-basalt-warning" aria-hidden="true" />
			Unsaved changes
		</span>
	);
}

function TitleField({ title, onChange }: { title: string; onChange: (value: string) => void }) {
	return (
		<span className="group flex min-w-0 items-center gap-2">
			<Input
				type="text"
				value={title}
				onChange={(e) => onChange(e.target.value)}
				className="h-auto min-w-0 flex-1 rounded-md border-transparent bg-transparent p-0 text-xl font-semibold tracking-tight shadow-none hover:bg-basalt-accent/50 focus:bg-basalt-control md:text-2xl"
				aria-label="Document title"
				placeholder="Untitled document"
			/>
			<Pencil
				className="h-3.5 w-3.5 text-basalt-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
				strokeWidth={1.6}
				aria-hidden="true"
			/>
		</span>
	);
}

function MarkdownPreview({ content }: { content: string }) {
	const html = useMemo(() => renderMarkdown(content), [content]);

	return (
		<article
			className="markdown-surface h-[60vh] min-h-72 w-full"
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
	wid,
	documentId,
	versions,
	currentVersion,
}: {
	wid: string;
	documentId: string;
	versions: DocumentVersionSummary[];
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
						aria-current={v.version === currentVersion ? "true" : undefined}
						className={`grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
							v.version === currentVersion
								? "bg-basalt-primary/10 text-basalt-primary"
								: "text-basalt-muted-foreground"
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
									diffIndex === i
										? "text-basalt-primary"
										: "text-basalt-muted-foreground hover:text-basalt-foreground"
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
				<VersionDiff
					wid={wid}
					documentId={documentId}
					oldVersion={sorted[diffIndex + 1].version}
					newVersion={sorted[diffIndex].version}
				/>
			)}
		</div>
	);
}
