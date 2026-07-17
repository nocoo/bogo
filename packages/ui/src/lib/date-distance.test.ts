import { afterEach, describe, expect, it, vi } from "vitest";
import {
	formatCalendarDistance,
	formatDateWithDistance,
	formatYmdParts,
	parseYmd,
} from "./date-distance.js";

afterEach(() => {
	vi.useRealTimers();
});

describe("parseYmd", () => {
	it("parses valid calendar dates", () => {
		expect(parseYmd("2025-04-22")).toEqual({ y: 2025, m: 4, d: 22 });
	});

	it("rejects invalid shapes and impossible days", () => {
		expect(parseYmd("not-a-date")).toBeNull();
		expect(parseYmd("2026-13-01")).toBeNull();
		expect(parseYmd("2026-02-30")).toBeNull();
	});
});

describe("formatYmdParts", () => {
	it("omits zero units and always shows days when empty", () => {
		expect(formatYmdParts(1, 2, 25)).toBe("1y 2m 25d");
		expect(formatYmdParts(1, 0, 0)).toBe("1y");
		expect(formatYmdParts(0, 3, 0)).toBe("3m");
		expect(formatYmdParts(0, 0, 0)).toBe("0d");
		expect(formatYmdParts(0, 0, 5)).toBe("5d");
	});
});

describe("formatCalendarDistance", () => {
	it("matches the product example 1y 2m 25d", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 17)); // local 2026-07-17
		expect(formatCalendarDistance("2025-04-22")).toBe("1y 2m 25d");
	});

	it("returns 0d for today", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 1));
		expect(formatCalendarDistance("2026-01-01")).toBe("0d");
	});

	it("prefixes future dates with in", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 1));
		expect(formatCalendarDistance("2026-01-04")).toBe("in 3d");
		expect(formatCalendarDistance("2027-01-01")).toBe("in 1y");
	});

	it("handles month-end borrow", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 2, 1)); // 2026-03-01
		// from 2026-01-31 → 1m 1d (Jan 31 → Feb 28/Mar 1)
		expect(formatCalendarDistance("2026-01-31")).toBe("1m 1d");
	});

	it("returns null for invalid input", () => {
		expect(formatCalendarDistance("nope")).toBeNull();
	});
});

describe("formatDateWithDistance", () => {
	it("wraps distance in parentheses", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 17));
		expect(formatDateWithDistance("2025-04-22")).toBe("2025-04-22 (1y 2m 25d)");
	});

	it("falls back to bare value when unparsable", () => {
		expect(formatDateWithDistance("bad")).toBe("bad");
	});
});
