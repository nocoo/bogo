import type { TagScope } from "@bogo/shared";
import { Button } from "@nocoo/basalt";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { tagModel } from "../models/tag.model.js";
import { TagBadge } from "./TagBadge.js";

interface TagFilterProps {
	scope: TagScope;
	selected: string[];
	onChange: (tagIds: string[]) => void;
}

export function TagFilter({ scope, selected, onChange }: TagFilterProps) {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const { data: allTags } = useQuery(tagModel.queryOptions(wid, scope));

	if (!allTags || allTags.length === 0) {
		return null;
	}

	const toggle = (tagId: string) => {
		if (selected.includes(tagId)) {
			onChange(selected.filter((id) => id !== tagId));
		} else {
			onChange([...selected, tagId]);
		}
	};

	return (
		<div className="flex items-center gap-2 flex-wrap">
			<Filter className="h-3.5 w-3.5 text-basalt-muted-foreground shrink-0" />
			{allTags.map((tag) => {
				const isActive = selected.includes(tag.id);
				return (
					<button
						key={tag.id}
						type="button"
						onClick={() => toggle(tag.id)}
						className={`rounded-full transition-shadow ${isActive ? "ring-2 ring-basalt-primary ring-offset-2 ring-offset-basalt-card" : "hover:ring-2 hover:ring-basalt-border"}`}
						aria-label={`${isActive ? "Remove" : "Add"} filter ${tag.name}`}
						aria-pressed={isActive}
					>
						<TagBadge name={tag.name} color={tag.color} size="sm" />
					</button>
				);
			})}
			{selected.length > 0 && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onChange([])}
					className="h-6 px-2 text-xs text-basalt-muted-foreground hover:text-basalt-foreground"
					aria-label="Clear tag filter"
				>
					Clear
				</Button>
			)}
		</div>
	);
}
