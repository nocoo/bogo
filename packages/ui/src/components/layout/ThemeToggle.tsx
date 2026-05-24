import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const THEME_CHANGE_EVENT = "theme-change";

function getStoredTheme(): Theme {
	return (localStorage.getItem("theme") as Theme) || "system";
}

function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
	const applied = theme === "system" ? getSystemTheme() : theme;
	document.documentElement.classList.toggle("dark", applied === "dark");
	document.documentElement.classList.toggle("light", applied !== "dark");
	localStorage.setItem("theme", theme);
	window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function initTheme() {
	const stored = getStoredTheme();
	const resolved = stored === "system" ? getSystemTheme() : stored;
	document.documentElement.classList.toggle("dark", resolved === "dark");
	document.documentElement.classList.toggle("light", resolved !== "dark");
}

function subscribeToTheme(callback: () => void) {
	window.addEventListener(THEME_CHANGE_EVENT, callback);
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handler = () => {
		if (getStoredTheme() === "system") {
			applyTheme("system");
		}
		callback();
	};
	mediaQuery.addEventListener("change", handler);
	return () => {
		window.removeEventListener(THEME_CHANGE_EVENT, callback);
		mediaQuery.removeEventListener("change", handler);
	};
}

function getSnapshot(): Theme {
	return getStoredTheme();
}

function getServerSnapshot(): Theme {
	return "system";
}

const ICON_PROPS = { className: "h-4 w-4", "aria-hidden": true as const, strokeWidth: 1.5 };

export function ThemeToggle() {
	const theme = useSyncExternalStore(subscribeToTheme, getSnapshot, getServerSnapshot);

	const cycleTheme = useCallback(() => {
		let next: Theme;
		if (theme === "system") {
			next = "light";
		} else if (theme === "light") {
			next = "dark";
		} else {
			next = "system";
		}
		applyTheme(next);
	}, [theme]);

	return (
		<button
			type="button"
			onClick={cycleTheme}
			aria-label={`Theme: ${theme}`}
			className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
		>
			{theme === "system" ? (
				<Monitor {...ICON_PROPS} />
			) : theme === "dark" ? (
				<Moon {...ICON_PROPS} />
			) : (
				<Sun {...ICON_PROPS} />
			)}
		</button>
	);
}
