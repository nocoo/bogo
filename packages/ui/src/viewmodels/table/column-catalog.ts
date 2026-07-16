import type { BuiltinColumnName, ColumnKey, CustomFieldDefinition } from "@bogo/shared";
import { builtinColumnNames, builtinNameFromKey, fieldIdFromColumnKey } from "@bogo/shared";

export type ColumnMeta = {
	key: ColumnKey;
	label: string;
	sortable: boolean;
	filterable: boolean;
	kind:
		| "text"
		| "number"
		| "date"
		| "date-day"
		| "boolean"
		| "select"
		| "person-ref"
		| "tags"
		| "avatar";
};

const BUILTIN_META: Record<BuiltinColumnName, Omit<ColumnMeta, "key">> = {
	name: { label: "Name", sortable: true, filterable: true, kind: "text" },
	title: { label: "Title", sortable: true, filterable: true, kind: "text" },
	managerId: { label: "Manager", sortable: true, filterable: true, kind: "person-ref" },
	dottedManagerId: {
		label: "Dotted manager",
		sortable: true,
		filterable: true,
		kind: "person-ref",
	},
	avatarUrl: { label: "Avatar", sortable: false, filterable: false, kind: "avatar" },
	isRoot: { label: "Root", sortable: true, filterable: true, kind: "boolean" },
	tags: { label: "Tags", sortable: false, filterable: true, kind: "tags" },
	createdAt: { label: "Created", sortable: true, filterable: true, kind: "date-day" },
	updatedAt: { label: "Updated", sortable: true, filterable: true, kind: "date-day" },
};

export function builtinColumnMetas(): ColumnMeta[] {
	return builtinColumnNames.map((name) => ({
		key: `builtin:${name}` as ColumnKey,
		...BUILTIN_META[name],
	}));
}

export function resolveColumnMeta(key: ColumnKey, defs: CustomFieldDefinition[]): ColumnMeta {
	const builtin = builtinNameFromKey(key);
	if (builtin) {
		return { key, ...BUILTIN_META[builtin] };
	}
	const fieldId = fieldIdFromColumnKey(key);
	const def = defs.find((d) => d.id === fieldId);
	if (!def) {
		return {
			key,
			label: "Missing field",
			sortable: false,
			filterable: false,
			kind: "text",
		};
	}
	const kind =
		def.fieldType === "date"
			? "date"
			: def.fieldType === "number"
				? "number"
				: def.fieldType === "boolean"
					? "boolean"
					: def.fieldType === "select"
						? "select"
						: "text";
	return {
		key,
		label: def.name,
		sortable: true,
		filterable: true,
		kind,
	};
}
