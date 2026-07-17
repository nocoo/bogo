import type { CustomFieldDefinition, ViewFilter } from "@bogo/shared";
import type { ColumnMeta } from "@/viewmodels/table/column-catalog";

/**
 * Type-aware filter value control. Empty / is_empty ops render nothing
 * (caller gates on op).
 */
export function FilterValueInput({
	filter,
	meta,
	def,
	personTags,
	onChange,
}: {
	filter: ViewFilter;
	meta: ColumnMeta | undefined;
	def: CustomFieldDefinition | undefined;
	/** Tags for person scope (id + name). */
	personTags: { id: string; name: string }[];
	onChange: (value: ViewFilter["value"]) => void;
}) {
	const kind = meta?.kind ?? "text";
	const op = filter.op;

	if (op === "is_empty" || op === "is_not_empty") {
		return null;
	}

	if (kind === "boolean") {
		const v = typeof filter.value === "string" ? filter.value : "";
		return (
			<select
				className="field-select field-sm min-w-[8rem] flex-1"
				value={v === "true" || v === "false" ? v : ""}
				onChange={(e) => onChange(e.target.value)}
				aria-label="Filter value"
			>
				<option value="" disabled>
					Select…
				</option>
				<option value="true">Yes</option>
				<option value="false">No</option>
			</select>
		);
	}

	if (kind === "select" && op !== "in") {
		const options = def?.options ?? [];
		const v = typeof filter.value === "string" ? filter.value : "";
		return (
			<select
				className="field-select field-sm min-w-[8rem] flex-1"
				value={v}
				onChange={(e) => onChange(e.target.value)}
				aria-label="Filter value"
			>
				<option value="" disabled>
					Select…
				</option>
				{options.map((opt) => (
					<option key={opt} value={opt}>
						{opt}
					</option>
				))}
			</select>
		);
	}

	if (kind === "select" && op === "in") {
		const selected = new Set(Array.isArray(filter.value) ? filter.value : []);
		const options = def?.options ?? [];
		return (
			<fieldset className="m-0 flex min-w-[10rem] flex-1 flex-wrap gap-1 border-0 p-0">
				<legend className="sr-only">Filter values</legend>
				{options.map((opt) => {
					const on = selected.has(opt);
					return (
						<button
							key={opt}
							type="button"
							className={
								on
									? "btn-secondary btn-sm bg-accent text-accent-foreground"
									: "btn-secondary btn-sm"
							}
							aria-pressed={on}
							onClick={() => {
								const next = new Set(selected);
								if (on) next.delete(opt);
								else next.add(opt);
								onChange([...next]);
							}}
						>
							{opt}
						</button>
					);
				})}
			</fieldset>
		);
	}

	if (kind === "tags" && op === "in") {
		const selected = new Set(Array.isArray(filter.value) ? filter.value : []);
		if (personTags.length === 0) {
			return <span className="text-xs text-muted-foreground">No person tags defined</span>;
		}
		return (
			<fieldset className="m-0 flex min-w-[10rem] flex-1 flex-wrap gap-1 border-0 p-0">
				<legend className="sr-only">Filter tags</legend>
				{personTags.map((t) => {
					const on = selected.has(t.id);
					return (
						<button
							key={t.id}
							type="button"
							className={
								on
									? "btn-secondary btn-sm bg-accent text-accent-foreground"
									: "btn-secondary btn-sm"
							}
							aria-pressed={on}
							onClick={() => {
								const next = new Set(selected);
								if (on) next.delete(t.id);
								else next.add(t.id);
								onChange([...next]);
							}}
						>
							{t.name}
						</button>
					);
				})}
			</fieldset>
		);
	}

	if (kind === "number") {
		return (
			<input
				type="number"
				className="field field-sm min-w-[8rem] flex-1"
				value={typeof filter.value === "string" ? filter.value : ""}
				onChange={(e) => onChange(e.target.value)}
				aria-label="Filter value"
			/>
		);
	}

	if (kind === "date" || kind === "date-day") {
		return (
			<input
				type="date"
				className="field field-sm min-w-[8rem] flex-1"
				value={typeof filter.value === "string" ? filter.value : ""}
				onChange={(e) => onChange(e.target.value)}
				aria-label="Filter value"
			/>
		);
	}

	// text, person-ref, and remaining `in` freeform
	if (op === "in") {
		return (
			<input
				className="field field-sm min-w-[10rem] flex-1"
				placeholder={
					kind === "person-ref" ? "Names or ids, comma-separated" : "comma-separated values"
				}
				value={Array.isArray(filter.value) ? filter.value.join(", ") : ""}
				onChange={(e) => {
					const value = e.target.value
						.split(",")
						.map((s) => s.trim())
						.filter(Boolean);
					onChange(value);
				}}
				aria-label="Filter values"
			/>
		);
	}

	return (
		<input
			className="field field-sm min-w-[8rem] flex-1"
			value={typeof filter.value === "string" ? filter.value : ""}
			placeholder={kind === "person-ref" ? "Person name, e.g. Zheng Li" : undefined}
			onChange={(e) => onChange(e.target.value)}
			aria-label="Filter value"
		/>
	);
}
