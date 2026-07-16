import type { ColumnKey, CustomFieldDefinition, CustomFieldValue, Person } from "@bogo/shared";
import { builtinNameFromKey, fieldIdFromColumnKey } from "@bogo/shared";

export type ResolvedCell = {
	/** Display string (em-dash for empty). */
	display: string;
	/** Raw comparable value; null when resolved empty. */
	raw: string | null;
	/** True when showing field defaultValue (not an explicit stored value). */
	isDefault: boolean;
	/** For manager columns: person id if set. */
	refId?: string | null;
	/** For tags column. */
	tags?: Person["tags"];
};

const EMPTY = "—";

export function isResolvedEmpty(raw: string | null): boolean {
	return raw === null || raw === "";
}

/**
 * Resolve one cell for the table grid.
 * personsById is used for manager name lookup.
 */
export function resolveCell(
	person: Person,
	key: ColumnKey,
	defs: CustomFieldDefinition[],
	valuesByPersonField: Map<string, string>,
	personsById: Map<string, Person>,
): ResolvedCell {
	const builtin = builtinNameFromKey(key);
	if (builtin) {
		return resolveBuiltin(person, builtin, personsById);
	}

	const fieldId = fieldIdFromColumnKey(key);
	if (!fieldId) {
		return { display: EMPTY, raw: null, isDefault: false };
	}
	const def = defs.find((d) => d.id === fieldId);
	const mapKey = `${person.id}:${fieldId}`;
	const stored = valuesByPersonField.get(mapKey);

	if (stored !== undefined && stored !== "") {
		return { display: formatFieldDisplay(stored, def), raw: stored, isDefault: false };
	}
	if (def?.defaultValue != null && def.defaultValue !== "") {
		return {
			display: formatFieldDisplay(def.defaultValue, def),
			raw: def.defaultValue,
			isDefault: true,
		};
	}
	return { display: EMPTY, raw: null, isDefault: false };
}

function resolveBuiltin(
	person: Person,
	name: NonNullable<ReturnType<typeof builtinNameFromKey>>,
	personsById: Map<string, Person>,
): ResolvedCell {
	switch (name) {
		case "name":
			return { display: person.name || EMPTY, raw: person.name || null, isDefault: false };
		case "title":
			return {
				display: person.title || EMPTY,
				raw: person.title || null,
				isDefault: false,
			};
		case "managerId": {
			const id = person.managerId;
			if (!id) return { display: EMPTY, raw: null, isDefault: false, refId: null };
			const nameStr = personsById.get(id)?.name ?? EMPTY;
			return {
				display: nameStr,
				raw: nameStr === EMPTY ? null : nameStr,
				isDefault: false,
				refId: id,
			};
		}
		case "dottedManagerId": {
			const id = person.dottedManagerId;
			if (!id) return { display: EMPTY, raw: null, isDefault: false, refId: null };
			const nameStr = personsById.get(id)?.name ?? EMPTY;
			return {
				display: nameStr,
				raw: nameStr === EMPTY ? null : nameStr,
				isDefault: false,
				refId: id,
			};
		}
		case "avatarUrl":
			return {
				display: person.avatarUrl || EMPTY,
				raw: person.avatarUrl,
				isDefault: false,
			};
		case "isRoot":
			return {
				display: person.isRoot ? "Yes" : "No",
				raw: person.isRoot ? "true" : "false",
				isDefault: false,
			};
		case "tags":
			return {
				display: person.tags.map((t) => t.name).join(", ") || EMPTY,
				raw: person.tags.length ? person.tags.map((t) => t.id).join(",") : null,
				isDefault: false,
				tags: person.tags,
			};
		case "createdAt":
			return { display: person.createdAt, raw: person.createdAt, isDefault: false };
		case "updatedAt":
			return { display: person.updatedAt, raw: person.updatedAt, isDefault: false };
		default:
			return { display: EMPTY, raw: null, isDefault: false };
	}
}

function formatFieldDisplay(value: string, def: CustomFieldDefinition | undefined): string {
	if (!def) return value;
	if (def.fieldType === "boolean") {
		return value === "true" ? "Yes" : value === "false" ? "No" : value;
	}
	return value;
}

/** Build map personId:fieldDefId -> value from bulk values list. */
export function indexFieldValues(values: CustomFieldValue[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const v of values) {
		m.set(`${v.personId}:${v.fieldDefId}`, v.value);
	}
	return m;
}

export function indexPersons(persons: Person[]): Map<string, Person> {
	const m = new Map<string, Person>();
	for (const p of persons) m.set(p.id, p);
	return m;
}

/** UTC calendar day YYYY-MM-DD from ISO timestamp. */
export function utcDay(iso: string): string | null {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 10);
}
