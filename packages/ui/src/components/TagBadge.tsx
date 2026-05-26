import { cva } from "class-variance-authority";
import { getTagColors } from "../lib/tag-colors.js";
import { cn } from "../lib/utils.js";

const badgeVariants = cva("inline-flex items-center rounded-full border font-medium truncate", {
	variants: {
		size: {
			sm: "px-2 py-0.5 text-xs max-w-[120px]",
			md: "px-2.5 py-0.5 text-sm max-w-[160px]",
		},
	},
	defaultVariants: {
		size: "sm",
	},
});

interface TagBadgeProps {
	name: string;
	color: string | null;
	size?: "sm" | "md";
	className?: string;
}

export function TagBadge({ name, color, size, className }: TagBadgeProps) {
	const tokens = getTagColors(color);

	return (
		<span
			className={cn(badgeVariants({ size }), className)}
			style={{
				backgroundColor: tokens.bg,
				color: tokens.text,
				borderColor: tokens.border,
			}}
			title={name}
		>
			{name}
		</span>
	);
}
