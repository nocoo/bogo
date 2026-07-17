import type { FilterOperator } from "@bogo/shared";
import type { ColumnMeta } from "./column-catalog.js";

/** Operators allowed per column kind — mirrors worker `table-view-logic` OPS. */
export const FILTER_OPS_BY_KIND: Record<ColumnMeta["kind"], readonly FilterOperator[]> = {
	text: ["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"],
	number: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
	date: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
	"date-day": ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
	boolean: ["eq", "neq", "is_empty", "is_not_empty"],
	select: ["eq", "neq", "in", "is_empty", "is_not_empty"],
	"person-ref": ["eq", "neq", "contains", "not_contains", "in", "is_empty", "is_not_empty"],
	tags: ["in", "is_empty", "is_not_empty"],
	avatar: [],
};

export function opsForKind(kind: ColumnMeta["kind"]): readonly FilterOperator[] {
	return FILTER_OPS_BY_KIND[kind] ?? FILTER_OPS_BY_KIND.text;
}

/** True when this filter op is valid for the column kind (historical stale ops → skip). */
export function isFilterOpAllowedForKind(kind: string, op: FilterOperator): boolean {
	const allowed = FILTER_OPS_BY_KIND[kind as ColumnMeta["kind"]];
	if (!allowed || allowed.length === 0) return false;
	return allowed.includes(op);
}
