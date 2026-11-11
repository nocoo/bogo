import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme } from "./theme-init.js";

function renderWithTheme() {
	return render(
		<ThemeProvider storageKey="theme" defaultTheme="system">
			<ThemeToggle aria-label="Toggle theme" />
		</ThemeProvider>,
	);
}

let matchMediaResult = true;

function createFakeStorage(): Storage {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (index: number) => Object.keys(store)[index] ?? null,
	};
}

beforeEach(() => {
	const fakeStorage = createFakeStorage();
	vi.stubGlobal("localStorage", fakeStorage);
	Object.defineProperty(window, "localStorage", { value: fakeStorage, configurable: true });
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
	vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
	it("renders with a theme control", () => {
		renderWithTheme();
		expect(screen.getByRole("button", { name: "Toggle theme" })).toBeTruthy();
	});

	it("cycles system → light → dark on click", () => {
		renderWithTheme();
		const btn = screen.getByRole("button", { name: "Toggle theme" });

		fireEvent.click(btn);
		expect(document.documentElement.classList.contains("light")).toBe(true);
		expect(document.documentElement.classList.contains("dark")).toBe(false);

		fireEvent.click(btn);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});
});

describe("initTheme", () => {
	it("stored=light → html has light, not dark", () => {
		localStorage.setItem("theme", "light");
		initTheme();
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("stored=dark → html has dark", () => {
		localStorage.setItem("theme", "dark");
		initTheme();
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});

	it("no stored + system dark → html has dark", () => {
		matchMediaResult = true;
		initTheme();
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("no stored + system light → html has light", () => {
		matchMediaResult = false;
		initTheme();
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});
});
