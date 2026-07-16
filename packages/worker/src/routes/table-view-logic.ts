import {
	type BuiltinColumnName,
	builtinNameFromKey,
	type ColumnKey,
	type FieldType,
	type FilterOperator,
	fieldIdFromColumnKey,
	isSortableBuiltin,
	isUuidString,
	isValidDateYmd,
	isValidFiniteNumberString,
	type ViewFilter,
	type ViewSort,
	validateFilterWireShape,
} from "@bogo/shared";

export type FieldDefMeta = {
	id: string;
	fieldType: FieldType;
	options: string[] | null;
};

export type ResolvedColumn =
	| { status: "builtin"; name: BuiltinColumnName }
	| { status: "field"; id: string; fieldType: FieldType; options: string[] | null }
	| { status: "stale"; id: string };

export function resolveColumn(key: string, defs: Map<string, FieldDefMeta>): ResolvedColumn {
	const builtin = builtinNameFromKey(key);
	if (builtin) return { status: "builtin", name: builtin };
	const fieldId = fieldIdFromColumnKey(key);
	if (!fieldId) {
		// columnKeySchema should have rejected this; treat as stale-like unknown
		return { status: "stale", id: key };
	}
	const def = defs.get(fieldId);
	if (!def) return { status: "stale", id: fieldId };
	return {
		status: "field",
		id: fieldId,
		fieldType: def.fieldType,
		options: def.options,
	};
}

export function isStaleColumn(col: ResolvedColumn): boolean {
	return col.status === "stale";
}

export function isSortableResolved(col: ResolvedColumn): boolean {
	if (col.status === "stale") return false;
	if (col.status === "builtin") return isSortableBuiltin(col.name);
	// all custom field types are sortable
	return true;
}

type ColumnFilterKind =
	| "text"
	| "number"
	| "date"
	| "date-day"
	| "boolean"
	| "select"
	| "person-ref"
	| "tags"
	| "none";

export function filterKindOf(col: ResolvedColumn): ColumnFilterKind {
	if (col.status === "stale") return "none";
	if (col.status === "builtin") {
		switch (col.name) {
			case "name":
			case "title":
				return "text";
			case "managerId":
			case "dottedManagerId":
				return "person-ref";
			case "isRoot":
				return "boolean";
			case "tags":
				return "tags";
			case "createdAt":
			case "updatedAt":
				return "date-day";
			case "avatarUrl":
				return "none";
			default:
				return "none";
		}
	}
	switch (col.fieldType) {
		case "text":
			return "text";
		case "number":
			return "number";
		case "date":
			return "date";
		case "boolean":
			return "boolean";
		case "select":
			return "select";
		default:
			return "none";
	}
}

const OPS: Record<ColumnFilterKind, ReadonlySet<FilterOperator>> = {
	text: new Set(["eq", "neq", "contains", "not_contains", "is_empty", "is_not_empty"]),
	number: new Set(["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"]),
	date: new Set(["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"]),
	"date-day": new Set(["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"]),
	boolean: new Set(["eq", "neq", "is_empty", "is_not_empty"]),
	select: new Set(["eq", "neq", "in", "is_empty", "is_not_empty"]),
	"person-ref": new Set(["eq", "neq", "in", "is_empty", "is_not_empty"]),
	tags: new Set(["in", "is_empty", "is_not_empty"]),
	none: new Set(),
};

export function validateColumnsStructure(columns: string[]): string | null {
	if (!columns.includes("builtin:name")) {
		return "columns must include builtin:name";
	}
	const seen = new Set<string>();
	for (const k of columns) {
		if (seen.has(k)) return `duplicate column key: ${k}`;
		seen.add(k);
	}
	return null;
}

/** New field keys must exist in defs. */
export function validateNewFieldKeys(
	columns: string[],
	prevColumns: string[] | null,
	defs: Map<string, FieldDefMeta>,
): string | null {
	const prev = new Set(prevColumns ?? []);
	for (const key of columns) {
		const fieldId = fieldIdFromColumnKey(key);
		if (!fieldId) continue;
		if (prevColumns !== null && prev.has(key)) continue; // retained (may be stale)
		if (!defs.has(fieldId)) {
			return `Unknown field: ${fieldId}`;
		}
	}
	return null;
}

export function validateSortAgainstColumns(
	sort: ViewSort,
	columns: string[],
	defs: Map<string, FieldDefMeta>,
): string | null {
	if (sort === null) return null;
	if (!columns.includes(sort.key)) {
		return "sort.key must be in columns";
	}
	const col = resolveColumn(sort.key, defs);
	if (isStaleColumn(col)) {
		return "sort.key must not reference a missing field";
	}
	if (!isSortableResolved(col)) {
		return "column is not sortable";
	}
	return null;
}

function validateValueFormat(
	kind: ColumnFilterKind,
	op: FilterOperator,
	value: string | string[] | null | undefined,
	options: string[] | null,
): string | null {
	if (op === "is_empty" || op === "is_not_empty") return null;

	if (op === "in") {
		if (!Array.isArray(value)) return "in requires string array";
		for (const el of value) {
			const t = el.trim();
			if (kind === "person-ref" || kind === "tags") {
				if (!isUuidString(t)) return "in elements must be UUIDs";
			} else if (kind === "select") {
				if (options && !options.includes(el) && !options.includes(t)) {
					// allow exact option match; options are case-sensitive as stored
					if (!options.includes(el)) return `value must be one of: ${options.join(", ")}`;
				}
			}
		}
		return null;
	}

	if (typeof value !== "string") return "value must be string";
	const v = value; // already non-empty trimmed by wire shape for non-empty ops

	switch (kind) {
		case "text":
			return null;
		case "number":
			return isValidFiniteNumberString(v) ? null : "value must be a valid finite number";
		case "date":
		case "date-day":
			return isValidDateYmd(v.trim()) ? null : "value must be YYYY-MM-DD";
		case "boolean":
			return v === "true" || v === "false" ? null : "value must be 'true' or 'false'";
		case "select":
			if (options && !options.includes(v)) {
				return `value must be one of: ${options.join(", ")}`;
			}
			return null;
		case "person-ref":
			return isUuidString(v.trim()) ? null : "value must be a UUID";
		// tags / none: non-empty ops are rejected earlier via OPS allow-list
		default:
			return "column is not filterable";
	}
}

export function validateFilterAgainstColumn(
	filter: ViewFilter,
	columns: string[],
	defs: Map<string, FieldDefMeta>,
): string | null {
	const wire = validateFilterWireShape(filter);
	if (wire) return wire;
	if (!columns.includes(filter.key)) {
		return "filter.key must be in columns";
	}
	const col = resolveColumn(filter.key, defs);
	if (isStaleColumn(col)) {
		return "filter.key must not reference a missing field";
	}
	const kind = filterKindOf(col);
	if (kind === "none" || !OPS[kind].has(filter.op)) {
		return `operator ${filter.op} not allowed for this column`;
	}
	const options = col.status === "field" ? col.options : null;
	return validateValueFormat(kind, filter.op, filter.value, options);
}

export function stripRemovedColumnRefs(
	columns: ColumnKey[],
	sort: ViewSort,
	filters: ViewFilter[],
): { sort: ViewSort; filters: ViewFilter[] } {
	const set = new Set(columns);
	let nextSort = sort;
	if (nextSort && !set.has(nextSort.key)) {
		nextSort = null;
	}
	const nextFilters = filters.filter((f) => set.has(f.key));
	return { sort: nextSort, filters: nextFilters };
}

export function parseColumnsJson(raw: string): ColumnKey[] {
	return JSON.parse(raw) as ColumnKey[];
}

export function parseSortJson(raw: string | null): ViewSort {
	if (raw === null || raw === undefined) return null;
	return JSON.parse(raw) as ViewSort;
}

export function parseFiltersJson(raw: string): ViewFilter[] {
	return JSON.parse(raw) as ViewFilter[];
}
