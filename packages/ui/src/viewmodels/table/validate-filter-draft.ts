import type { CustomFieldDefinition, ViewFilter } from "@bogo/shared";
import {
	fieldIdFromColumnKey,
	isUuidString,
	isValidDateYmd,
	isValidFiniteNumberString,
} from "@bogo/shared";
import type { ColumnMeta } from "./column-catalog.js";
import { isFilterOpAllowedForKind } from "./filter-ops.js";

/**
 * Validate one filter against column kind + optional field def (value shape/format).
 * Returns an error message, or null if the filter is applicable at read/write time.
 *
 * Used both for draft save (UI) and for skipping historical/stale filters on the grid
 * (type change left eq "abc" on a number column, empty values, bad tag ids, etc.).
 */
export function validateFilterValue(
	filter: ViewFilter,
	meta: ColumnMeta,
	def: CustomFieldDefinition | undefined,
): string | null {
	if (!meta.filterable || meta.kind === "avatar") {
		return `Column “${meta.label}” is not filterable`;
	}
	if (!isFilterOpAllowedForKind(meta.kind, filter.op)) {
		return `Operator “${filter.op}” is not allowed for ${meta.label}`;
	}
	if (filter.op === "is_empty" || filter.op === "is_not_empty") {
		return null;
	}

	if (filter.op === "in") {
		if (!Array.isArray(filter.value) || filter.value.length === 0) {
			return `${meta.label}: select at least one value for “in”`;
		}
		if (meta.kind === "tags") {
			for (const id of filter.value) {
				if (!isUuidString(id.trim())) {
					return `${meta.label}: tag filters must use tag ids`;
				}
			}
		}
		if (meta.kind === "select" && def?.options) {
			for (const el of filter.value) {
				if (!def.options.includes(el) && !def.options.includes(el.trim())) {
					return `${meta.label}: “${el}” is not a valid option`;
				}
			}
		}
		// person-ref / freeform in: non-empty strings already enforced by wire shape
		for (const el of filter.value) {
			if (typeof el !== "string" || el.trim() === "") {
				return `${meta.label}: “in” values must be non-empty`;
			}
		}
		return null;
	}

	if (typeof filter.value !== "string" || filter.value.trim() === "") {
		return `${meta.label}: value is required`;
	}
	const v = filter.value;

	if (meta.kind === "number" && !isValidFiniteNumberString(v)) {
		return `${meta.label}: must be a finite number`;
	}
	if ((meta.kind === "date" || meta.kind === "date-day") && !isValidDateYmd(v.trim())) {
		return `${meta.label}: must be YYYY-MM-DD`;
	}
	if (meta.kind === "boolean") {
		const t = v.trim();
		if (t !== "true" && t !== "false") {
			return `${meta.label}: must be Yes or No`;
		}
	}
	if (meta.kind === "select" && def?.options) {
		if (!def.options.includes(v) && !def.options.includes(v.trim())) {
			return `${meta.label}: pick a valid option`;
		}
	}
	return null;
}

/** Client-side check before PUT filters — first failing rule wins. */
export function validateFilterDraft(
	filters: ViewFilter[],
	columnMetas: ColumnMeta[],
	defs: CustomFieldDefinition[],
): string | null {
	for (const f of filters) {
		const meta = columnMetas.find((c) => c.key === f.key);
		if (!meta) {
			return `Unknown column in filter: ${f.key}`;
		}
		const fieldId = fieldIdFromColumnKey(f.key);
		const def = fieldId ? defs.find((d) => d.id === fieldId) : undefined;
		const err = validateFilterValue(f, meta, def);
		if (err) return err;
	}
	return null;
}
