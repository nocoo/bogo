import type { CustomFieldDefinition, ViewFilter } from "@bogo/shared";
import { isUuidString, isValidDateYmd, isValidFiniteNumberString } from "@bogo/shared";
import type { ColumnMeta } from "./column-catalog.js";
import { isFilterOpAllowedForKind } from "./filter-ops.js";

/** Client-side check before PUT filters — mirrors worker rules enough to block obvious mistakes. */
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
		if (!meta.filterable) {
			return `Column “${meta.label}” is not filterable`;
		}
		if (!isFilterOpAllowedForKind(meta.kind, f.op)) {
			return `Operator “${f.op}” is not allowed for ${meta.label}`;
		}
		if (f.op === "is_empty" || f.op === "is_not_empty") {
			continue;
		}

		const def = f.key.startsWith("field:")
			? defs.find((d) => f.key === `field:${d.id}`)
			: undefined;

		if (f.op === "in") {
			if (!Array.isArray(f.value) || f.value.length === 0) {
				return `${meta.label}: select at least one value for “in”`;
			}
			if (meta.kind === "tags") {
				for (const id of f.value) {
					if (!isUuidString(id.trim())) {
						return `${meta.label}: tag filters must use tag ids`;
					}
				}
			}
			if (meta.kind === "select" && def?.options) {
				for (const el of f.value) {
					if (!def.options.includes(el) && !def.options.includes(el.trim())) {
						return `${meta.label}: “${el}” is not a valid option`;
					}
				}
			}
			continue;
		}

		if (typeof f.value !== "string" || f.value.trim() === "") {
			return `${meta.label}: value is required`;
		}
		const v = f.value;

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
	}
	return null;
}
