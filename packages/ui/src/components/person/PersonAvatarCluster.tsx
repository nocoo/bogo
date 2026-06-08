import { cn } from "../../lib/utils.js";
import { PersonAvatar } from "./PersonAvatar.js";

interface PersonItem {
	id: string;
	name: string;
	avatarUrl?: string | null;
}

interface PersonAvatarClusterProps {
	people: PersonItem[];
	/** Max avatars to render before collapsing the tail into a "+N" bubble. */
	max?: number;
	size?: "xs" | "sm" | "md";
	className?: string;
}

/**
 * Overlapping avatar cluster, for compact summaries (e.g. a document card
 * showing who is associated). When the people list exceeds `max`, the extra
 * count is shown as a "+N" bubble at the end.
 */
export function PersonAvatarCluster({
	people,
	max = 4,
	size = "sm",
	className,
}: PersonAvatarClusterProps) {
	if (people.length === 0) return null;

	const visible = people.slice(0, max);
	const overflow = people.length - visible.length;

	const ringOffset =
		size === "xs" ? "-ml-1.5 ring-2" : size === "md" ? "-ml-2.5 ring-2" : "-ml-2 ring-2";

	const overflowSize =
		size === "xs"
			? "h-5 min-w-[1.25rem] text-[10px]"
			: size === "md"
				? "h-7 min-w-[1.75rem] text-xs"
				: "h-6 min-w-[1.5rem] text-[11px]";

	return (
		<div
			className={cn("flex items-center", className)}
			title={`${people.length} ${people.length === 1 ? "person" : "people"} associated`}
		>
			{visible.map((p, i) => (
				<PersonAvatar
					key={p.id}
					name={p.name}
					avatarUrl={p.avatarUrl}
					size={size}
					className={cn("ring-card", i === 0 ? "ml-0" : ringOffset)}
				/>
			))}
			{overflow > 0 && (
				<span
					className={cn(
						"inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium px-1 ring-card",
						ringOffset,
						overflowSize,
					)}
					aria-hidden="true"
				>
					+{overflow}
				</span>
			)}
		</div>
	);
}
