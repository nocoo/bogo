import { LayerCard } from "@nocoo/basalt";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { GripVertical } from "lucide-react";
import { memo } from "react";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { PersonHover } from "@/components/person/PersonHover";
import { TagBadge } from "@/components/TagBadge.js";
import type { PersonNodeData } from "@/viewmodels/person/person-tree-layout.js";

export const PersonNode = memo(function PersonNode({
	data,
	selected,
}: NodeProps & { data: PersonNodeData }) {
	return (
		<LayerCard
			className={`group flex w-[240px] items-center gap-3 px-4 py-3 transition-shadow ${
				selected ? "ring-2 ring-basalt-primary" : "hover:ring-1 hover:ring-basalt-border"
			}`}
		>
			<Handle type="target" position={Position.Top} className="!bg-basalt-primary !w-2 !h-2" />

			<PersonHover personId={data.person.id}>
				<PersonAvatar name={data.person.name} avatarUrl={data.person.avatarUrl} size="lg" />
			</PersonHover>

			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-basalt-foreground truncate">{data.person.name}</p>
				{data.person.title && (
					<p className="text-xs text-basalt-muted-foreground truncate">{data.person.title}</p>
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
							<li key={f.fieldDefId} className="text-xs text-basalt-muted-foreground truncate">
								<span className="text-basalt-foreground/70">{f.name}:</span>{" "}
								{f.value || <span className="italic opacity-60">—</span>}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
				<GripVertical className="h-4 w-4 text-basalt-muted-foreground" strokeWidth={1.5} />
			</div>

			<Handle type="source" position={Position.Bottom} className="!bg-basalt-primary !w-2 !h-2" />
		</LayerCard>
	);
});
