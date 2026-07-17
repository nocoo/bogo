import { z } from "zod/v4";

/** Builtin person columns available as table-view columns. */
export const builtinColumnNames = [
	"name",
	"title",
	"managerId",
	"dottedManagerId",
	"avatarUrl",
	"isRoot",
	"tags",
	"createdAt",
	"updatedAt",
] as const;

export type BuiltinColumnName = (typeof builtinColumnNames)[number];

const BUILTIN_KEY_RE =
	/^builtin:(name|title|managerId|dottedManagerId|avatarUrl|isRoot|tags|createdAt|updatedAt)$/;
const FIELD_KEY_RE = /^field:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const columnKeySchema = z
	.string()
	.refine((k) => BUILTIN_KEY_RE.test(k) || FIELD_KEY_RE.test(k), { message: "Invalid column key" });

export type ColumnKey = z.infer<typeof columnKeySchema>;

export const filterOperators = [
	"eq",
	"neq",
	"contains",
	"not_contains",
	"gt",
	"gte",
	"lt",
	"lte",
	"is_empty",
	"is_not_empty",
	"in",
] as const;

export type FilterOperator = (typeof filterOperators)[number];

export const viewSortSchema = z
	.object({
		key: columnKeySchema,
		direction: z.enum(["asc", "desc"]),
	})
	.nullable();

export type ViewSort = z.infer<typeof viewSortSchema>;

export const viewFilterSchema = z.object({
	key: columnKeySchema,
	op: z.enum(filterOperators),
	value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
});

export type ViewFilter = z.infer<typeof viewFilterSchema>;

/** POST body — handler supplies defaults for omitted sort/filters/isDefault. */
export const createPersonTableViewSchema = z.object({
	name: z.string().min(1).max(100),
	columns: z.array(columnKeySchema).min(1).max(64),
	sort: viewSortSchema.optional(),
	filters: z.array(viewFilterSchema).max(32).optional(),
	isDefault: z.boolean().optional(),
});

export type CreatePersonTableViewInput = z.infer<typeof createPersonTableViewSchema>;

/**
 * PUT body — independent schema with NO zod .default().
 * Omitted keys stay absent so load-merge-validate does not clear filters/default.
 */
export const updatePersonTableViewSchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		columns: z.array(columnKeySchema).min(1).max(64).optional(),
		sort: viewSortSchema.optional(),
		filters: z.array(viewFilterSchema).max(32).optional(),
		isDefault: z.boolean().optional(),
		sortOrder: z.number().int().min(0).optional(),
	})
	.refine((b) => Object.keys(b).length > 0, { message: "empty patch" });

export type UpdatePersonTableViewInput = z.infer<typeof updatePersonTableViewSchema>;

export interface PersonTableView {
	id: string;
	workspaceId: string;
	name: string;
	columns: ColumnKey[];
	sort: ViewSort;
	filters: ViewFilter[];
	isDefault: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/** Columns that cannot be used as sort keys. */
export const UNSORTABLE_BUILTIN = new Set<BuiltinColumnName>(["avatarUrl", "tags"]);

/** Columns that cannot be filtered. */
export const UNFILTERABLE_BUILTIN = new Set<BuiltinColumnName>(["avatarUrl"]);

export function isBuiltinColumnKey(key: string): key is `builtin:${BuiltinColumnName}` {
	return BUILTIN_KEY_RE.test(key);
}

export function builtinNameFromKey(key: string): BuiltinColumnName | null {
	const m = key.match(BUILTIN_KEY_RE);
	return m ? (m[1] as BuiltinColumnName) : null;
}

export function fieldIdFromColumnKey(key: string): string | null {
	const m = key.match(FIELD_KEY_RE);
	return m ? key.slice("field:".length) : null;
}

export function isSortableBuiltin(name: BuiltinColumnName): boolean {
	return !UNSORTABLE_BUILTIN.has(name);
}

export function isValidFiniteNumberString(value: string): boolean {
	const n = Number(value);
	return value.trim() !== "" && !Number.isNaN(n) && Number.isFinite(n);
}

export function isValidDateYmd(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value: string): boolean {
	return UUID_RE.test(value);
}

/**
 * Coarse wire-shape check for a single filter (no column-type knowledge).
 * Returns error message or null if ok.
 */
export function validateFilterWireShape(filter: ViewFilter): string | null {
	const { op, value } = filter;
	if (op === "is_empty" || op === "is_not_empty") {
		if (value !== undefined && value !== null) {
			return "is_empty/is_not_empty must omit value or use null";
		}
		return null;
	}
	if (op === "in") {
		if (!Array.isArray(value) || value.length < 1) {
			return "in requires a non-empty string array";
		}
		for (const el of value) {
			if (typeof el !== "string" || el.trim() === "") {
				return "in array elements must be non-empty strings after trim";
			}
		}
		return null;
	}
	if (typeof value !== "string") {
		return `${op} requires a string value`;
	}
	if (value.trim() === "") {
		return `${op} value must be non-empty after trim`;
	}
	return null;
}

/** Default columns for the seeded All People view. */
export const DEFAULT_TABLE_VIEW_COLUMNS: ColumnKey[] = [
	"builtin:name",
	"builtin:title",
	"builtin:managerId",
];

export const DEFAULT_TABLE_VIEW_NAME = "All People";
