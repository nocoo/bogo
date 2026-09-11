import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * Standard back control for detail / editor pages.
 *
 * - Icon-only (no children): sits left of the page title/identity row.
 * - With children: low-weight text link (`← Label`), e.g. document editor.
 *
 * Prefer `to` (Link) for list parents. Use `onClick` only when navigation is
 * custom (tests, conditional history).
 */
export function PageBackLink({
	to,
	onClick,
	ariaLabel,
	children,
	className,
}: {
	to?: string;
	onClick?: () => void;
	ariaLabel: string;
	children?: ReactNode;
	className?: string;
}) {
	const withLabel = children != null && children !== false;
	const classes = cn("shrink-0 text-basalt-muted-foreground", !withLabel && "h-8 w-8", className);
	const content = (
		<>
			<ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
			{withLabel ? <span>{children}</span> : null}
		</>
	);

	if (to) {
		return (
			<Button asChild variant="ghost" size={withLabel ? "sm" : "icon"} className={classes}>
				<Link to={to} aria-label={ariaLabel}>
					{content}
				</Link>
			</Button>
		);
	}

	return (
		<Button
			variant="ghost"
			size={withLabel ? "sm" : "icon"}
			onClick={onClick}
			aria-label={ariaLabel}
			className={classes}
		>
			{content}
		</Button>
	);
}

import { Button } from "@nocoo/basalt";
