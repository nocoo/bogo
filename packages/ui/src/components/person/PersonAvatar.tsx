import { cva } from "class-variance-authority";
import { useState } from "react";
import { avatarColors, avatarInitial } from "../../lib/avatar.js";
import { cn } from "../../lib/utils.js";

const avatarVariants = cva(
	"inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0 overflow-hidden",
	{
		variants: {
			size: {
				xs: "h-5 w-5 text-[10px]",
				sm: "h-6 w-6 text-[11px]",
				md: "h-7 w-7 text-xs",
				lg: "h-9 w-9 text-sm",
			},
		},
		defaultVariants: {
			size: "sm",
		},
	},
);

interface PersonAvatarProps {
	/** Person's display name. Used for both the letter and the hashed color. */
	name: string;
	/** Optional uploaded avatar URL. When present and the image loads, replaces
	 * the letter rendering; if the request fails we fall back to the letter. */
	avatarUrl?: string | null;
	size?: "xs" | "sm" | "md" | "lg";
	className?: string;
}

/**
 * Standard avatar element used everywhere a Person is shown.
 *
 * Renders:
 *   - The uploaded image (if `avatarUrl` is set and loads successfully), OR
 *   - A colored circle with the name's first letter (uppercase, white text)
 *     where the background is selected from an 8-swatch palette using a
 *     stable hash of the full name.
 */
export function PersonAvatar({ name, avatarUrl, size, className }: PersonAvatarProps) {
	const [imageFailed, setImageFailed] = useState(false);
	const showImage = Boolean(avatarUrl) && !imageFailed;

	const { bg, fg } = avatarColors(name);
	const initial = avatarInitial(name);

	return (
		<span
			className={cn(avatarVariants({ size }), className)}
			style={showImage ? undefined : { backgroundColor: bg, color: fg }}
			role="img"
			aria-label={name ? `Avatar for ${name}` : "Avatar"}
			title={name || undefined}
		>
			{showImage ? (
				<img
					src={avatarUrl as string}
					alt=""
					className="h-full w-full object-cover"
					onError={() => setImageFailed(true)}
				/>
			) : (
				<span aria-hidden="true">{initial}</span>
			)}
		</span>
	);
}
