import type { ColumnKey } from "@bogo/shared";

export const LOCKED_COLUMN_KEY: ColumnKey = "builtin:name";

export function isLockedColumn(key: ColumnKey): boolean {
	return key === LOCKED_COLUMN_KEY;
}

/** Ensure locked name column is present (prepend if missing). */
export function ensureNameColumn(keys: ColumnKey[]): ColumnKey[] {
	if (keys.includes(LOCKED_COLUMN_KEY)) return keys;
	return [LOCKED_COLUMN_KEY, ...keys];
}

/**
 * Move `key` to `toIndex` using insert-before semantics on the original list
 * (`toIndex === keys.length` means append).
 *
 * Adjusts the index when moving right so dropping onto item C places the
 * dragged item *before* C (or at end when dropping past the last chip).
 */
export function reorderSelected(keys: ColumnKey[], key: ColumnKey, toIndex: number): ColumnKey[] {
	const from = keys.indexOf(key);
	if (from < 0) return keys;

	const next = keys.filter((k) => k !== key);
	let insertAt = toIndex;
	// Removing an earlier item shifts later indices down by one.
	if (from < toIndex) {
		insertAt = toIndex - 1;
	}
	insertAt = Math.max(0, Math.min(insertAt, next.length));
	next.splice(insertAt, 0, key);

	if (next.length === keys.length && next.every((k, i) => k === keys[i])) {
		return keys;
	}
	return next;
}

/** Add candidate to end of selected (no-op if already selected). */
export function addColumn(keys: ColumnKey[], key: ColumnKey): ColumnKey[] {
	if (keys.includes(key)) return keys;
	return [...keys, key];
}

/** Remove from selected; locked name cannot be removed. */
export function removeColumn(keys: ColumnKey[], key: ColumnKey): ColumnKey[] {
	if (isLockedColumn(key)) return keys;
	return keys.filter((k) => k !== key);
}

/** Shift selected item left/right by one step. */
export function nudgeColumn(
	keys: ColumnKey[],
	key: ColumnKey,
	direction: "left" | "right",
): ColumnKey[] {
	const i = keys.indexOf(key);
	if (i < 0) return keys;
	const j = direction === "left" ? i - 1 : i + 1;
	if (j < 0 || j >= keys.length) return keys;
	const next = [...keys];
	const a = next[i];
	const b = next[j];
	if (a === undefined || b === undefined) return keys;
	next[i] = b;
	next[j] = a;
	return next;
}
