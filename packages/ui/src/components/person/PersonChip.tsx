import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { PersonAvatar } from "./PersonAvatar.js";

interface PersonChipProps {
	name: string;
	avatarUrl?: string | null;
	/** Subtitle line shown to the right of the name (e.g. a role or title). */
	subtitle?: string;
	size?: "sm" | "md";
	/** When provided, renders a remove (×) button on the right. */
	onRemove?: () => void;
	/** Set true while the parent is removing this row, to disable the × button. */
	isRemoving?: boolean;
	className?: string;
}

/**
 * Standard "Person line" template. Used everywhere a Person appears in lists,
 * sidebars, association editors, and detail panels:
 *
 *   [avatar]  Name
 *             optional subtitle
 *
 * Goals:
 *   - Consistent visual identity for People across the app.
 *   - A single place to evolve the spec (avatar size, subtitle, hover state).
 *
 * Use PersonAvatarCluster (separate component) for compact overlapping
 * groups; use this for one-line readable rows.
 */
export function PersonChip({
	name,
	avatarUrl,
	subtitle,
	size = "sm",
	onRemove,
	isRemoving,
	className,
}: PersonChipProps) {
	const avatarSize = size === "md" ? "md" : "sm";

	return (
		<div
			className={cn(
				"group inline-flex items-center gap-2 min-w-0 max-w-full",
				size === "md" ? "text-sm" : "text-xs",
				className,
			)}
		>
			<PersonAvatar name={name} avatarUrl={avatarUrl} size={avatarSize} />
			<div className="flex min-w-0 flex-col leading-tight">
				<span className="truncate text-foreground font-medium">{name}</span>
				{subtitle && <span className="truncate text-muted-foreground text-[11px]">{subtitle}</span>}
			</div>
			{onRemove && (
				<button
					type="button"
					onClick={onRemove}
					disabled={isRemoving}
					className="shrink-0 ml-auto text-muted-foreground hover:text-red-400 disabled:opacity-50 transition-colors"
					aria-label={`Remove ${name}`}
				>
					<X className="h-3.5 w-3.5" strokeWidth={1.8} />
				</button>
			)}
		</div>
	);
}
