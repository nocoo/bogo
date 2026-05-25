import type { PersonNodeData } from "@/viewmodels/person/person-tree-layout.js";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { GripVertical, User } from "lucide-react";
import { memo } from "react";

export const PersonNode = memo(function PersonNode({
	data,
	selected,
}: NodeProps & { data: PersonNodeData }) {
	return (
		<div
			className={`group flex w-[240px] items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors ${
				selected
					? "border-primary bg-primary/5 shadow-primary/10"
					: "border-border bg-card hover:border-primary/40"
			}`}
		>
			<Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
				<User className="h-4 w-4 text-primary" strokeWidth={1.5} />
			</div>

			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-foreground truncate">{data.person.name}</p>
				{data.person.title && (
					<p className="text-xs text-muted-foreground truncate">{data.person.title}</p>
				)}
			</div>

			<div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
				<GripVertical className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
			</div>

			<Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
		</div>
	);
});
