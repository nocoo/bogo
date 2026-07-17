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
	const classes = cn(withLabel ? "page-back" : "btn-icon h-8 w-8 shrink-0", className);
	const content = (
		<>
			<ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
			{withLabel ? <span>{children}</span> : null}
		</>
	);

	if (to) {
		return (
			<Link to={to} aria-label={ariaLabel} className={classes}>
				{content}
			</Link>
		);
	}

	return (
		<button type="button" onClick={onClick} aria-label={ariaLabel} className={classes}>
			{content}
		</button>
	);
}
