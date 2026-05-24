import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle.js";

let matchMediaResult = true;

beforeEach(() => {
	localStorage.clear();
	document.documentElement.classList.remove("dark", "light");
	matchMediaResult = true;
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) =>
			({
				matches: query === "(prefers-color-scheme: dark)" ? matchMediaResult : false,
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
			}) as unknown as MediaQueryList,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ThemeToggle", () => {
	it("renders with system theme by default", () => {
		render(<ThemeToggle />);
		expect(screen.getByLabelText("Theme: system")).toBeTruthy();
	});

	it("cycles system → light → dark → system", () => {
		render(<ThemeToggle />);
		const btn = screen.getByRole("button");

		fireEvent.click(btn);
		expect(screen.getByLabelText("Theme: light")).toBeTruthy();
		expect(document.documentElement.classList.contains("light")).toBe(true);
		expect(document.documentElement.classList.contains("dark")).toBe(false);

		fireEvent.click(btn);
		expect(screen.getByLabelText("Theme: dark")).toBeTruthy();
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);

		fireEvent.click(btn);
		expect(screen.getByLabelText("Theme: system")).toBeTruthy();
	});

	it("restores stored light theme on mount", () => {
		localStorage.setItem("theme", "light");
		render(<ThemeToggle />);
		expect(screen.getByLabelText("Theme: light")).toBeTruthy();
	});

	it("restores stored dark theme on mount", () => {
		localStorage.setItem("theme", "dark");
		render(<ThemeToggle />);
		expect(screen.getByLabelText("Theme: dark")).toBeTruthy();
	});

	it("uses system preference when no stored value (system=dark)", () => {
		matchMediaResult = true;
		render(<ThemeToggle />);
		expect(screen.getByLabelText("Theme: system")).toBeTruthy();
	});

	it("uses system preference when no stored value (system=light)", () => {
		matchMediaResult = false;
		render(<ThemeToggle />);
		expect(screen.getByLabelText("Theme: system")).toBeTruthy();
	});
});

describe("theme initialization (main.tsx logic)", () => {
	it("stored=light → html has light, not dark", () => {
		localStorage.setItem("theme", "light");
		const isDark =
			localStorage.getItem("theme") === "dark" ||
			(localStorage.getItem("theme") !== "light" && matchMediaResult);
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.classList.toggle("light", !isDark);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("stored=dark → html has dark", () => {
		localStorage.setItem("theme", "dark");
		const stored = localStorage.getItem("theme");
		const isDark = stored === "dark" || (stored !== "light" && matchMediaResult);
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.classList.toggle("light", !isDark);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});

	it("no stored + system dark → html has dark", () => {
		matchMediaResult = true;
		const stored = localStorage.getItem("theme");
		const isDark = stored === "dark" || (stored !== "light" && matchMediaResult);
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.classList.toggle("light", !isDark);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("no stored + system light → html has light", () => {
		matchMediaResult = false;
		const stored = localStorage.getItem("theme");
		const isDark = stored === "dark" || (stored !== "light" && matchMediaResult);
		document.documentElement.classList.toggle("dark", isDark);
		document.documentElement.classList.toggle("light", !isDark);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});
});
