import type { EmbeddedTag, TagScope } from "@bogo/shared";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@nocoo/basalt";
import { useQuery } from "@tanstack/react-query";
import { Check, Tags } from "lucide-react";
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

	const { data: allTags } = useQuery(tagModel.queryOptions(wid, scope));
	const { assign, unassign } = useTagAssignment(scope);

	const assignedIds = new Set((assignedTags ?? []).map((t) => t.id));

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="h-auto min-h-9 max-w-full justify-start"
					aria-label="Manage tags"
				>
					<Tags className="h-4 w-4 shrink-0" strokeWidth={1.5} />
					{assignedTags.length > 0 ? (
						<span className="flex min-w-0 flex-wrap gap-1">
							{assignedTags.map((tag) => (
								<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
							))}
						</span>
					) : (
						"Add tags"
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{(!allTags || allTags.length === 0) && (
					<p className="px-2 py-1.5 text-xs text-basalt-muted-foreground">No tags available</p>
				)}
				{allTags?.map((tag) => (
					<DropdownMenuItem
						key={tag.id}
						role="menuitemcheckbox"
						aria-checked={assignedIds.has(tag.id)}
						onSelect={(event) => {
							event.preventDefault();
							if (assignedIds.has(tag.id)) unassign(tag.id, entityId);
							else assign(tag.id, entityId);
						}}
					>
						<span className="mr-2 h-4 w-4">
							{assignedIds.has(tag.id) && (
								<Check className="h-4 w-4 text-basalt-primary" strokeWidth={1.5} />
							)}
						</span>
						<TagBadge name={tag.name} color={tag.color} size="sm" />
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
