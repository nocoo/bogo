import type { DocumentType } from "@bogo/shared";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface DocTypePickerProps {
	types: DocumentType[];
	value: string | null;
	onChange: (typeId: string | null) => void;
	disabled?: boolean;
}

/**
 * Inline picker for selecting a document's `typeId`. Renders the current type
 * as a colored pill; clicking opens a menu of all available types with an
 * "Unset" option. Mirrors the visual language of TagPicker.
 */
export function DocTypePicker({ types, value, onChange, disabled }: DocTypePickerProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const selected = types.find((t) => t.id === value) ?? null;

	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const pick = useCallback(
		(id: string | null) => {
			onChange(id);
			setOpen(false);
		},
		[onChange],
	);

	const swatch = selected?.color ?? "var(--muted-foreground)";

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => !disabled && setOpen(!open)}
				disabled={disabled}
				className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
				aria-label="Change document type"
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span
					className="h-2 w-2 rounded-full shrink-0"
					style={{ backgroundColor: swatch }}
					aria-hidden="true"
				/>
				<span className="truncate max-w-[160px]">{selected?.name ?? "No type"}</span>
				<ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={2} />
			</button>

			{open && (
				<div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-lg bg-popover p-1 shadow-md">
					{types.length === 0 ? (
						<p className="px-2 py-1.5 text-xs text-muted-foreground">No types defined</p>
					) : (
						<>
							<TypeRow
								name="No type"
								color={null}
								checked={value === null}
								onClick={() => pick(null)}
							/>
							<div className="my-1 h-px bg-border" aria-hidden="true" />
							{types.map((t) => (
								<TypeRow
									key={t.id}
									name={t.name}
									color={t.color}
									checked={t.id === value}
									onClick={() => pick(t.id)}
								/>
							))}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function TypeRow({
	name,
	color,
	checked,
	onClick,
}: {
	name: string;
	color: string | null;
	checked: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			role="option"
			aria-selected={checked}
			className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
		>
			<span
				className="h-2 w-2 rounded-full shrink-0"
				style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
				aria-hidden="true"
			/>
			<span className="flex-1 text-left truncate">{name}</span>
			{checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
		</button>
	);
}
