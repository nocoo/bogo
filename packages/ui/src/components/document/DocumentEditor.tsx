import type { DocumentVersion, UpdateDocumentInput } from "@bogo/shared";
import { AlertCircle, ArrowLeft, Loader2, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { DocumentVM } from "../../viewmodels/document/use-document.js";

export function DocumentEditor({
	vm,
	onBack,
}: {
	vm: DocumentVM;
	onBack: () => void;
}) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [dirty, setDirty] = useState(false);

	useEffect(() => {
		if (vm.document) {
			setTitle(vm.document.title);
			setContent(vm.document.content);
			setDirty(false);
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
			vm.update(input);
			setDirty(false);
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
					className="flex-1 bg-transparent text-lg font-semibold text-foreground outline-none border-b border-transparent focus:border-primary transition-colors"
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

			{vm.mutationError && (
				<div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span className="flex-1">{vm.mutationError.message}</span>
					<button
						type="button"
						onClick={vm.clearMutationError}
						className="shrink-0 text-red-400 hover:text-red-300"
						aria-label="Dismiss error"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			)}

			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>v{vm.document.version}</span>
				{dirty && <span className="text-amber-400">Unsaved changes</span>}
			</div>

			<textarea
				value={content}
				onChange={(e) => handleContentChange(e.target.value)}
				className="w-full min-h-[400px] rounded-lg border border-border bg-card p-4 text-sm text-foreground font-mono outline-none focus:border-primary resize-y transition-colors"
				placeholder="Write document content..."
				aria-label="Document content"
			/>

			{vm.versions.length > 0 && (
				<VersionList versions={vm.versions} currentVersion={vm.document.version} />
			)}
		</div>
	);
}

function VersionList({
	versions,
	currentVersion,
}: {
	versions: DocumentVersion[];
	currentVersion: number;
}) {
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold text-foreground">Version History</h3>
			<div className="space-y-1">
				{versions.map((v) => (
					<div
						key={v.id}
						className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs ${
							v.version === currentVersion ? "bg-primary/10 text-primary" : "text-muted-foreground"
						}`}
					>
						<span className="font-medium">v{v.version}</span>
						<span className="flex-1 truncate">{v.title}</span>
						<span>{v.createdAt}</span>
					</div>
				))}
			</div>
		</div>
	);
}
