import type { CustomFieldDefinition, ViewFilter } from "@bogo/shared";
import { Button, Input } from "@nocoo/basalt";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
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
		const selected = v === "true" || v === "false" ? v : "";
		return (
			<Select value={selected} onValueChange={onChange}>
				<SelectTrigger size="sm" className="min-w-[8rem] flex-1" aria-label="Filter value">
					<SelectValue placeholder="Select…" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="true">Yes</SelectItem>
					<SelectItem value="false">No</SelectItem>
				</SelectContent>
			</Select>
		);
	}

	if (kind === "select" && op !== "in") {
		const options = def?.options ?? [];
		const v = typeof filter.value === "string" ? filter.value : "";
		return (
			<Select value={v} onValueChange={onChange}>
				<SelectTrigger size="sm" className="min-w-[8rem] flex-1" aria-label="Filter value">
					<SelectValue placeholder="Select…" />
				</SelectTrigger>
				<SelectContent>
					{options.map((opt) => (
						<SelectItem key={opt} value={opt}>
							{opt}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	if (op === "in" && (kind === "select" || kind === "tags")) {
		const selected = new Set(Array.isArray(filter.value) ? filter.value : []);
		const options =
			kind === "tags" ? personTags : (def?.options ?? []).map((name) => ({ id: name, name }));
		if (options.length === 0) {
			return (
				<span className="text-xs text-basalt-muted-foreground">
					{kind === "tags" ? "No person tags defined" : "No options defined"}
				</span>
			);
		}
		return (
			<fieldset className="m-0 flex min-w-0 flex-1 flex-wrap gap-1 border-0 p-0">
				<legend className="sr-only">{kind === "tags" ? "Filter tags" : "Filter values"}</legend>
				{options.map((option) => (
					<Button
						key={option.id}
						variant="outline"
						size="sm"
						aria-pressed={selected.has(option.id)}
						className={selected.has(option.id) ? "bg-basalt-accent" : undefined}
						onClick={() => {
							const next = new Set(selected);
							if (next.has(option.id)) next.delete(option.id);
							else next.add(option.id);
							onChange([...next]);
						}}
					>
						{option.name}
					</Button>
				))}
			</fieldset>
		);
	}

	// text, person-ref, and remaining `in` freeform
	if (op === "in") {
		return (
			<Input
				className="h-8 min-w-[10rem] flex-1"
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
		<Input
			type={kind === "number" ? "number" : kind === "date" || kind === "date-day" ? "date" : "text"}
			className="h-8 min-w-[8rem] flex-1"
			value={typeof filter.value === "string" ? filter.value : ""}
			placeholder={kind === "person-ref" ? "Person name, e.g. Zheng Li" : undefined}
			onChange={(e) => onChange(e.target.value)}
			aria-label="Filter value"
		/>
	);
}
