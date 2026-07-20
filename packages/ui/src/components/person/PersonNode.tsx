import { Handle, type NodeProps, Position } from "@xyflow/react";
import { GripVertical } from "lucide-react";
import { memo } from "react";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { TagBadge } from "@/components/TagBadge.js";
import type { PersonNodeData } from "@/viewmodels/person/person-tree-layout.js";

export const PersonNode = memo(function PersonNode({
	data,
	selected,
}: NodeProps & { data: PersonNodeData }) {
	return (
		<div
			className={`group flex w-[240px] items-center gap-3 rounded-card border bg-secondary px-4 py-3 transition-colors ${
				selected ? "border-primary" : "border-border hover:border-primary/40"
			}`}
		>
			<Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

			<PersonAvatar name={data.person.name} avatarUrl={data.person.avatarUrl} size="lg" />

			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground truncate">{data.person.name}</p>
				{data.person.title && (
					<p className="text-xs text-muted-foreground truncate">{data.person.title}</p>
				)}
				{data.person.tags.length > 0 && (
					<div className="flex gap-1 mt-1 flex-wrap">
						{data.person.tags.map((tag) => (
							<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
						))}
					</div>
				)}
				{data.fields.length > 0 && (
					<ul className="mt-1 space-y-0.5">
						{data.fields.map((f) => (
							<li key={f.fieldDefId} className="text-xs text-muted-foreground truncate">
								<span className="text-foreground/70">{f.name}:</span>{" "}
								{f.value || <span className="italic opacity-60">—</span>}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
				<GripVertical className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
			</div>

			<Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
		</div>
	);
});
