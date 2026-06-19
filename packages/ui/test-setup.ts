// happy-dom@20 + Node 26 + vitest@4 do not auto-inject the Web Storage API
// onto globalThis (only `window`), and `globals: true` does not bridge them.
// This shim provides an in-memory localStorage / sessionStorage so existing
// tests that call `localStorage.clear()` / `setItem()` work in both shells.

class MemoryStorage implements Storage {
	private store = new Map<string, string>();
	get length(): number {
		return this.store.size;
	}
	clear(): void {
		this.store.clear();
	}
	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}
	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}
	removeItem(key: string): void {
		this.store.delete(key);
	}
	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
}

if (typeof globalThis.localStorage === "undefined") {
	Object.defineProperty(globalThis, "localStorage", {
		value: new MemoryStorage(),
		writable: true,
		configurable: true,
	});
}
if (typeof globalThis.sessionStorage === "undefined") {
	Object.defineProperty(globalThis, "sessionStorage", {
		value: new MemoryStorage(),
		writable: true,
		configurable: true,
	});
}
