// ---------------------------------------------------------------------------
// Name → color mapping
//
// Hashes a person's name (UTF-8 code points) and maps the hash to one of
// 8 swatches. The hash is deterministic and stable across sessions so a
// given name always renders with the same color.
// ---------------------------------------------------------------------------

/** 8-color avatar palette. Material/OpenColor-inspired, saturated enough to
 * read against the dark theme but not so vivid they fight Bogo's deep blue. */
const AVATAR_PALETTE: readonly { bg: string; fg: string }[] = [
	{ bg: "#ef4444", fg: "#ffffff" }, // red
	{ bg: "#f97316", fg: "#ffffff" }, // orange
	{ bg: "#f59e0b", fg: "#1f2937" }, // amber  (dark fg for legibility)
	{ bg: "#10b981", fg: "#ffffff" }, // emerald
	{ bg: "#14b8a6", fg: "#ffffff" }, // teal
	{ bg: "#3b82f6", fg: "#ffffff" }, // blue
	{ bg: "#8b5cf6", fg: "#ffffff" }, // violet
	{ bg: "#ec4899", fg: "#ffffff" }, // pink
] as const;

/**
 * Stable string hash → integer. Variant of djb2; deterministic across runs,
 * survives Unicode (uses code points), and exhibits good distribution over
 * short strings (names).
 */
function hashName(name: string): number {
	let h = 5381;
	for (const char of name) {
		const cp = char.codePointAt(0) ?? 0;
		// h * 33 + cp, clamped to 32-bit unsigned to stay stable
		h = (h * 33 + cp) >>> 0;
	}
	return h;
}

/** Pick a palette swatch for a name. Empty/whitespace names fall to swatch 0. */
export function avatarColors(name: string): { bg: string; fg: string } {
	const trimmed = name.trim();
	if (!trimmed) {
		return AVATAR_PALETTE[0];
	}
	const idx = hashName(trimmed) % AVATAR_PALETTE.length;
	return AVATAR_PALETTE[idx];
}

/**
 * First letter of the first non-empty word in the name, uppercased.
 * Falls back to "?" for empty input. Handles CJK by returning the first
 * grapheme as-is (no case change for non-Latin scripts).
 */
export function avatarInitial(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		return "?";
	}
	// Find first non-whitespace word; first code-point of that word.
	const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
	const firstChar = [...firstWord][0] ?? "?";
	return firstChar.toUpperCase();
}

/** Internal: exposed only for tests. */
export const AVATAR_PALETTE_SIZE = AVATAR_PALETTE.length;
