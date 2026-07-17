import type {
	ColumnKey,
	CustomFieldDefinition,
	CustomFieldValue,
	Person,
	PersonTableView,
	ViewFilter,
	ViewSort,
} from "@bogo/shared";
import { fieldIdFromColumnKey, isValidFiniteNumberString } from "@bogo/shared";
import { resolveColumnMeta } from "./column-catalog.js";
import {
	indexFieldValues,
	indexPersons,
	isResolvedEmpty,
	type ResolvedCell,
	resolveCell,
	utcDay,
} from "./resolve-cell.js";
import { validateFilterValue } from "./validate-filter-draft.js";

export type GridRow = {
	person: Person;
	cells: Record<string, ResolvedCell>;
};

export type GridResult = {
	rows: GridRow[];
	total: number;
	filteredCount: number;
	skippedSort: boolean;
	skippedFilters: number;
};

function compareRaw(
	a: string | null,
	b: string | null,
	kind: string,
	direction: "asc" | "desc",
): number {
	const emptyA = isResolvedEmpty(a);
	const emptyB = isResolvedEmpty(b);
	if (emptyA && emptyB) return 0;
	if (emptyA) return 1; // always bottom
	if (emptyB) return -1;

	let cmp = 0;
	if (kind === "number") {
		const na = Number(a);
		const nb = Number(b);
		const fa = Number.isFinite(na);
		const fb = Number.isFinite(nb);
		if (!fa && !fb) cmp = 0;
		else if (!fa) return 1;
		else if (!fb) return -1;
		else cmp = na - nb;
	} else if (kind === "boolean") {
		const ta = (a as string).trim() === "true" ? 1 : 0;
		const tb = (b as string).trim() === "true" ? 1 : 0;
		cmp = ta - tb;
	} else {
		// Doc: trim both sides before text/select/date localeCompare
		cmp = (a as string).trim().localeCompare((b as string).trim(), "en-US", {
			sensitivity: "base",
		});
	}
	return direction === "asc" ? cmp : -cmp;
}

function normText(s: string): string {
	return s.trim().toLocaleLowerCase("en-US");
}

function matchFilter(
	cell: ResolvedCell,
	filter: ViewFilter,
	kind: string,
	person: Person,
): boolean {
	const op = filter.op;
	if (op === "is_empty") return isResolvedEmpty(cell.raw);
	if (op === "is_not_empty") return !isResolvedEmpty(cell.raw);

	// empty cells never match non-empty operators (incl. neq / not_contains)
	if (isResolvedEmpty(cell.raw)) {
		return false;
	}

	const raw = cell.raw ?? "";

	if (op === "in") {
		const arr = Array.isArray(filter.value) ? filter.value : [];
		if (kind === "tags") {
			const ids = new Set(person.tags.map((t) => t.id));
			return arr.some((id) => ids.has(id.trim()));
		}
		if (kind === "person-ref") {
			const id = cell.refId ?? "";
			const name = normText(cell.raw ?? "");
			return arr.some((v) => {
				const t = v.trim();
				return t === id || normText(t) === name;
			});
		}
		// select (and other string `in`): trim elements so worker-accepted " A " matches
		return arr.some((v) => v.trim() === raw.trim() || v === raw);
	}

	const fv = typeof filter.value === "string" ? filter.value : "";

	if (kind === "person-ref") {
		// Match resolved manager name (what the grid shows) or person id.
		const id = cell.refId ?? "";
		const name = normText(raw);
		const needle = fv.trim();
		const needleNorm = normText(needle);
		switch (op) {
			case "eq":
				return id === needle || name === needleNorm;
			case "neq":
				return id !== needle && name !== needleNorm;
			case "contains":
				return name.includes(needleNorm);
			case "not_contains":
				return !name.includes(needleNorm);
			default:
				return false;
		}
	}

	if (kind === "date-day") {
		const day = utcDay(raw);
		const target = fv.trim();
		if (!day) return false;
		switch (op) {
			case "eq":
				return day === target;
			case "neq":
				return day !== target;
			case "gt":
				return day > target;
			case "gte":
				return day >= target;
			case "lt":
				return day < target;
			case "lte":
				return day <= target;
			default:
				return false;
		}
	}

	if (kind === "number") {
		if (!isValidFiniteNumberString(raw) || !isValidFiniteNumberString(fv)) return false;
		const n = Number(raw);
		const m = Number(fv);
		switch (op) {
			case "eq":
				return n === m;
			case "neq":
				return n !== m;
			case "gt":
				return n > m;
			case "gte":
				return n >= m;
			case "lt":
				return n < m;
			case "lte":
				return n <= m;
			default:
				return false;
		}
	}

	if (kind === "boolean") {
		// Worker accepts padded literals (" true "); match after trim on both sides
		const rawT = raw.trim();
		const fvT = fv.trim();
		if (op === "eq") return rawT === fvT;
		if (op === "neq") return rawT !== fvT;
		return false;
	}

	// text / select / date (YYYY-MM-DD stored)
	if (kind === "text") {
		const h = normText(raw);
		const n = normText(fv);
		switch (op) {
			case "eq":
				return h === n;
			case "neq":
				return h !== n;
			case "contains":
				return h.includes(n);
			case "not_contains":
				return !h.includes(n);
			default:
				return false;
		}
	}

	// select / date: exact match with trimmed filter value (options themselves untrimmed)
	const fvTrim = fv.trim();
	switch (op) {
		case "eq":
			return raw === fv || raw === fvTrim;
		case "neq":
			return raw !== fv && raw !== fvTrim;
		case "gt":
			return raw > fvTrim;
		case "gte":
			return raw >= fvTrim;
		case "lt":
			return raw < fvTrim;
		case "lte":
			return raw <= fvTrim;
		default:
			return false;
	}
}

export function buildGrid(
	view: PersonTableView,
	persons: Person[],
	defs: CustomFieldDefinition[],
	values: CustomFieldValue[],
): GridResult {
	const personsById = indexPersons(persons);
	const valueMap = indexFieldValues(values);
	const columns = view.columns;

	const allRows: GridRow[] = persons.map((person) => {
		const cells: Record<string, ResolvedCell> = {};
		for (const key of columns) {
			cells[key] = resolveCell(person, key, defs, valueMap, personsById);
		}
		return { person, cells };
	});

	let skippedFilters = 0;
	const activeFilters: ViewFilter[] = [];
	for (const f of view.filters) {
		if (!columns.includes(f.key as ColumnKey)) {
			skippedFilters++;
			continue;
		}
		const meta = resolveColumnMeta(f.key as ColumnKey, defs);
		if (meta.label === "Missing field" && f.key.startsWith("field:")) {
			skippedFilters++;
			continue;
		}
		// Stale op or illegal value after type change (eq "abc" on number) → skip, keep all rows
		const fieldId = fieldIdFromColumnKey(f.key);
		const def: CustomFieldDefinition | undefined = fieldId
			? defs.find((d) => d.id === fieldId)
			: undefined;
		if (validateFilterValue(f, meta, def) !== null) {
			skippedFilters++;
			continue;
		}
		activeFilters.push(f);
	}

	let filtered = allRows;
	if (activeFilters.length > 0) {
		filtered = allRows.filter((row) =>
			activeFilters.every((f) => {
				const meta = resolveColumnMeta(f.key as ColumnKey, defs);
				const cell = row.cells[f.key];
				if (!cell) return false;
				return matchFilter(cell, f, meta.kind, row.person);
			}),
		);
	}

	let skippedSort = false;
	let sort: ViewSort = view.sort;
	if (sort) {
		const meta = resolveColumnMeta(sort.key as ColumnKey, defs);
		if (
			!columns.includes(sort.key as ColumnKey) ||
			!meta.sortable ||
			(sort.key.startsWith("field:") && meta.label === "Missing field")
		) {
			skippedSort = true;
			sort = null;
		}
	}

	const sorted = [...filtered];
	if (sort) {
		const meta = resolveColumnMeta(sort.key as ColumnKey, defs);
		const dir = sort.direction;
		const key = sort.key;
		sorted.sort((ra, rb) => {
			const ca = ra.cells[key]?.raw ?? null;
			const cb = rb.cells[key]?.raw ?? null;
			// manager sort uses resolved name (already in raw)
			const cmp = compareRaw(ca, cb, meta.kind, dir);
			if (cmp !== 0) return cmp;
			return ra.person.id.localeCompare(rb.person.id);
		});
	} else {
		sorted.sort((a, b) => {
			const cmp = a.person.name.localeCompare(b.person.name, "en-US", {
				sensitivity: "base",
			});
			if (cmp !== 0) return cmp;
			return a.person.id.localeCompare(b.person.id);
		});
	}

	return {
		rows: sorted,
		total: persons.length,
		filteredCount: sorted.length,
		skippedSort,
		skippedFilters,
	};
}
