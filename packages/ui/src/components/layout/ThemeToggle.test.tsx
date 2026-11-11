import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function renderBasaltThemeToggle() {
	return render(
		<ThemeProvider storageKey="theme" defaultTheme="system">
			<ThemeToggle />
		</ThemeProvider>,
	);
}

function expectDocumentTheme(mode: "light" | "dark") {
	expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
	expect(document.documentElement.classList.contains("light")).toBe(mode === "light");
	expect(document.documentElement.dataset.mode).toBe(mode);
}

beforeEach(() => {
	const fakeStorage = createFakeStorage();
	vi.stubGlobal("localStorage", fakeStorage);
	Object.defineProperty(window, "localStorage", { value: fakeStorage, configurable: true });
	document.documentElement.classList.remove("dark", "light");
	delete document.documentElement.dataset.mode;
	matchMediaResult = false;
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

describe("ThemeToggle (basalt 3.3)", () => {
	it("cycles system → light → dark → system with aria labels and document classes", () => {
		renderBasaltThemeToggle();

		const systemBtn = screen.getByRole("button", { name: "Switch to light theme" });
		expect(systemBtn.getAttribute("data-theme")).toBe("system");
		expectDocumentTheme("light");

		fireEvent.click(systemBtn);
		const lightBtn = screen.getByRole("button", { name: "Switch to dark theme" });
		expect(lightBtn.getAttribute("data-theme")).toBe("light");
		expectDocumentTheme("light");

		fireEvent.click(lightBtn);
		const darkBtn = screen.getByRole("button", { name: "Use system theme" });
		expect(darkBtn.getAttribute("data-theme")).toBe("dark");
		expectDocumentTheme("dark");

		fireEvent.click(darkBtn);
		const backToSystem = screen.getByRole("button", { name: "Switch to light theme" });
		expect(backToSystem.getAttribute("data-theme")).toBe("system");
		expectDocumentTheme("light");
	});

	it("restores stored light theme on mount", () => {
		localStorage.setItem("theme", "light");
		renderBasaltThemeToggle();
		expect(
			screen.getByRole("button", { name: "Switch to dark theme" }).getAttribute("data-theme"),
		).toBe("light");
		expectDocumentTheme("light");
	});

	it("restores stored dark theme on mount", () => {
		localStorage.setItem("theme", "dark");
		renderBasaltThemeToggle();
		expect(
			screen.getByRole("button", { name: "Use system theme" }).getAttribute("data-theme"),
		).toBe("dark");
		expectDocumentTheme("dark");
	});

	it("uses system preference when no stored value (system=dark)", () => {
		matchMediaResult = true;
		renderBasaltThemeToggle();
		expect(
			screen.getByRole("button", { name: "Switch to light theme" }).getAttribute("data-theme"),
		).toBe("system");
		expectDocumentTheme("dark");
	});

	it("uses system preference when no stored value (system=light)", () => {
		matchMediaResult = false;
		renderBasaltThemeToggle();
		expect(
			screen.getByRole("button", { name: "Switch to light theme" }).getAttribute("data-theme"),
		).toBe("system");
		expectDocumentTheme("light");
	});
});
