import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initTheme } from "./theme-init.js";

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

describe("initTheme", () => {
	it("stored=light → html has light, not dark", () => {
		localStorage.setItem("theme", "light");
		initTheme();
		expectDocumentTheme("light");
	});

	it("stored=dark → html has dark", () => {
		localStorage.setItem("theme", "dark");
		initTheme();
		expectDocumentTheme("dark");
	});

	it("no stored + system dark → html has dark", () => {
		matchMediaResult = true;
		initTheme();
		expectDocumentTheme("dark");
	});

	it("no stored + system light → html has light", () => {
		matchMediaResult = false;
		initTheme();
		expectDocumentTheme("light");
	});

	it("falls back to system preference when localStorage.getItem throws", () => {
		matchMediaResult = false;
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage denied");
		});
		initTheme();
		expectDocumentTheme("light");
	});
});
