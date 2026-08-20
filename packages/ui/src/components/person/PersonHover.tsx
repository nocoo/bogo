import {
	Children,
	type FocusEvent,
	isValidElement,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { useOptionalWorkspaceContext } from "../../contexts/workspace-context.js";
import { usePersonPreview } from "../../viewmodels/person/use-person-preview.js";
import { TagBadge } from "../TagBadge.js";
import { PersonAvatar } from "./PersonAvatar.js";

const SHOW_MS = 160;
const HIDE_MS = 160;

type PersonHoverProps = {
	personId?: string | null;
	children: ReactNode;
};

export function PersonHover({ personId, children }: PersonHoverProps) {
	const ctx = useOptionalWorkspaceContext();
	if (!personId || !ctx?.workspaceId) {
		return children;
	}
	return <PersonHoverBound personId={personId}>{children}</PersonHoverBound>;
}

function isInteractiveChild(children: ReactNode): boolean {
	return Children.toArray(children).some((child) => {
		if (!isValidElement<{ href?: unknown; tabIndex?: number }>(child)) return false;
		if (child.type === "a" || child.type === "button" || child.type === Link) return true;
		return typeof child.props.href === "string" || child.props.tabIndex === 0;
	});
}

function PersonHoverBound({ personId, children }: { personId: string; children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const triggerRef = useRef<HTMLSpanElement>(null);
	const cardRef = useRef<HTMLDivElement>(null);
	const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const interactive = isInteractiveChild(children);

	useEffect(() => {
		return () => {
			if (showTimer.current) clearTimeout(showTimer.current);
			if (hideTimer.current) clearTimeout(hideTimer.current);
		};
	}, []);

	useLayoutEffect(() => {
		if (!open || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const width = 256;
		let left = rect.left;
		if (left + width > window.innerWidth - 8) {
			left = Math.max(8, window.innerWidth - width - 8);
		}
		let top = rect.bottom + 6;
		if (top + 240 > window.innerHeight) {
			top = Math.max(8, rect.top - 246);
		}
		setPos({ top, left });
	}, [open]);

	const show = () => {
		if (hideTimer.current) {
			clearTimeout(hideTimer.current);
			hideTimer.current = null;
		}
		if (open) return;
		showTimer.current = setTimeout(() => setOpen(true), SHOW_MS);
	};

	const hide = () => {
		if (showTimer.current) {
			clearTimeout(showTimer.current);
			showTimer.current = null;
		}
		hideTimer.current = setTimeout(() => setOpen(false), HIDE_MS);
	};

	const staysInside = (next: EventTarget | null) => {
		if (!(next instanceof Node)) return false;
		return Boolean(triggerRef.current?.contains(next) || cardRef.current?.contains(next));
	};

	const onBlur = (event: FocusEvent<HTMLElement>) => {
		if (staysInside(event.relatedTarget)) return;
		hide();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key !== "Tab" || event.shiftKey || !open) return;
		if (cardRef.current?.contains(event.target as Node)) return;
		const link = cardRef.current?.querySelector("a");
		if (!(link instanceof HTMLElement)) return;
		event.preventDefault();
		link.focus();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover card trigger wraps arbitrary children
		<span
			ref={triggerRef}
			className="relative inline-flex max-w-full"
			tabIndex={interactive ? undefined : 0}
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={onBlur}
			onKeyDown={onKeyDown}
		>
			{children}
			{open
				? createPortal(
						<div
							ref={cardRef}
							role="tooltip"
							className="fixed z-50 w-64"
							style={{ top: pos.top, left: pos.left }}
							onMouseEnter={show}
							onMouseLeave={hide}
							onFocus={show}
							onBlur={onBlur}
						>
							<PersonHoverPanel personId={personId} />
						</div>,
						document.body,
					)
				: null}
		</span>
	);
}

function PersonHoverPanel({ personId }: { personId: string }) {
	const { person, manager, fields } = usePersonPreview(personId);
	const name = person?.name ?? "Person";

	return (
		<div className="rounded-xl border border-border bg-popover p-3 text-left shadow-lg">
			<div className="flex items-start gap-3">
				<PersonAvatar name={name} avatarUrl={person?.avatarUrl} size="lg" />
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-foreground">{name}</p>
					{person?.title ? (
						<p className="truncate text-xs text-muted-foreground">{person.title}</p>
					) : null}
				</div>
			</div>

			<dl className="mt-3 space-y-1 text-xs">
				{manager ? (
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">Manager</dt>
						<dd className="truncate font-medium text-foreground">{manager.name}</dd>
					</div>
				) : null}
				{fields.map((f) => (
					<div key={f.name} className="flex justify-between gap-2">
						<dt className="text-muted-foreground">{f.name}</dt>
						<dd className="truncate font-medium text-foreground">{f.value}</dd>
					</div>
				))}
			</dl>

			{person && person.tags.length > 0 ? (
				<div className="mt-2 flex flex-wrap gap-1">
					{person.tags.map((tag) => (
						<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
					))}
				</div>
			) : null}

			<Link
				to={`/people/${personId}`}
				className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
			>
				Open profile
			</Link>
		</div>
	);
}
