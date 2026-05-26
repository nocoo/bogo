import type { EmbeddedTag, TagScope } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Tags } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { tagModel } from "../models/tag.model.js";
import { useTagAssignment } from "../viewmodels/tag/use-tag-assignment.js";
import { TagBadge } from "./TagBadge.js";

interface TagPickerProps {
	scope: TagScope;
	entityId: string;
	assignedTags: EmbeddedTag[];
}

export function TagPicker({ scope, entityId, assignedTags }: TagPickerProps) {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const { data: allTags } = useQuery(tagModel.queryOptions(wid, scope));
	const { assign, unassign } = useTagAssignment(scope);

	const assignedIds = new Set((assignedTags ?? []).map((t) => t.id));

	const toggle = useCallback(
		(tagId: string) => {
			if (assignedIds.has(tagId)) {
				unassign(tagId, entityId);
			} else {
				assign(tagId, entityId);
			}
		},
		[assignedIds, assign, unassign, entityId],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				aria-label="Manage tags"
			>
				<Tags className="h-3.5 w-3.5" />
				{assignedTags.length > 0 && (
					<span className="flex items-center gap-1">
						{assignedTags.map((tag) => (
							<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
						))}
					</span>
				)}
				{assignedTags.length === 0 && <span>Add tags</span>}
			</button>

			{open && (
				<div className="absolute top-full left-0 z-20 mt-1 w-52 rounded-lg border border-border bg-popover p-1 shadow-md">
					{(!allTags || allTags.length === 0) && (
						<p className="px-2 py-1.5 text-xs text-muted-foreground">No tags available</p>
					)}
					{allTags?.map((tag) => (
						<button
							key={tag.id}
							type="button"
							onClick={() => toggle(tag.id)}
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
						>
							<span className="flex h-4 w-4 items-center justify-center">
								{assignedIds.has(tag.id) && <Check className="h-3.5 w-3.5 text-primary" />}
							</span>
							<TagBadge name={tag.name} color={tag.color} size="sm" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}
