/**
 * Calendar distance between a YYYY-MM-DD date and "today", for table display.
 * Examples: `1y 2m 25d`, `3m 1d`, `0d`, `in 2d` (future).
 */

export type YmdParts = { y: number; m: number; d: number };

export function parseYmd(value: string): YmdParts | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const d = Number(m[3]);
	if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	// Reject impossible calendar days (e.g. 2026-02-30)
	const probe = new Date(y, mo - 1, d);
	if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) {
		return null;
	}
	return { y, m: mo, d };
}

function daysInMonth(year: number, month1to12: number): number {
	return new Date(year, month1to12, 0).getDate();
}

function compareYmd(a: YmdParts, b: YmdParts): number {
	if (a.y !== b.y) return a.y - b.y;
	if (a.m !== b.m) return a.m - b.m;
	return a.d - b.d;
}

function todayParts(now: Date): YmdParts {
	return {
		y: now.getFullYear(),
		m: now.getMonth() + 1,
		d: now.getDate(),
	};
}

/** Add months with day clamp (Jan 31 + 1m → Feb 28/29). */
function addMonthsClamped(parts: YmdParts, deltaMonths: number): YmdParts {
	const total = parts.y * 12 + (parts.m - 1) + deltaMonths;
	const y = Math.floor(total / 12);
	const m = (total % 12) + 1;
	const dim = daysInMonth(y, m);
	return { y, m, d: Math.min(parts.d, dim) };
}

function ymdToUtcMs(p: YmdParts): number {
	return Date.UTC(p.y, p.m - 1, p.d);
}

/** Format y/m/d parts; omit zero units except always show at least days when empty. */
export function formatYmdParts(years: number, months: number, days: number): string {
	const parts: string[] = [];
	if (years > 0) parts.push(`${years}y`);
	if (months > 0) parts.push(`${months}m`);
	if (days > 0 || parts.length === 0) parts.push(`${days}d`);
	return parts.join(" ");
}

function absoluteDistance(
	from: YmdParts,
	to: YmdParts,
): { years: number; months: number; days: number } {
	// Years
	let years = to.y - from.y;
	let cursor = addMonthsClamped(from, years * 12);
	if (compareYmd(cursor, to) > 0) {
		years -= 1;
		cursor = addMonthsClamped(from, years * 12);
	}

	// Months
	let months = (to.y - cursor.y) * 12 + (to.m - cursor.m);
	let afterMonths = addMonthsClamped(cursor, months);
	if (compareYmd(afterMonths, to) > 0) {
		months -= 1;
		afterMonths = addMonthsClamped(cursor, months);
	}

	// Remaining whole days
	const days = Math.round((ymdToUtcMs(to) - ymdToUtcMs(afterMonths)) / 86_400_000);

	return { years, months, days };
}

/**
 * Absolute calendar distance from `ymd` to local "today".
 * Past → `1y 2m 25d`; future → `in 1y 2m 25d`; same day → `0d`.
 */
export function formatCalendarDistance(ymd: string, now: Date = new Date()): string | null {
	const start = parseYmd(ymd);
	if (!start) return null;

	const today = todayParts(now);
	const cmp = compareYmd(start, today);
	if (cmp === 0) return "0d";

	const future = cmp > 0;
	const from = future ? today : start;
	const to = future ? start : today;
	const { years, months, days } = absoluteDistance(from, to);
	const core = formatYmdParts(years, months, days);
	return future ? `in ${core}` : core;
}

/** `2024-01-15 (1y 6m 2d)` — raw date unchanged when distance cannot be computed. */
export function formatDateWithDistance(ymd: string, now: Date = new Date()): string {
	const dist = formatCalendarDistance(ymd, now);
	return dist ? `${ymd} (${dist})` : ymd;
}
