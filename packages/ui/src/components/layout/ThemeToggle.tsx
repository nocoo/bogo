import { ThemeToggle as BasaltThemeToggle } from "@nocoo/basalt";
import { useTheme } from "@nocoo/basalt/providers/theme";

export function initTheme() {
	let stored: string | null = null;
	try {
		stored = window.localStorage.getItem("theme");
	} catch {
		// Continue with the system theme when browser storage is denied.
	}
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const isDark = stored === "dark" || (stored !== "light" && prefersDark);
	document.documentElement.classList.toggle("dark", isDark);
	document.documentElement.classList.toggle("light", !isDark);
	document.documentElement.dataset.mode = isDark ? "dark" : "light";
}

export function ThemeToggle() {
	const { theme } = useTheme();
	return <BasaltThemeToggle aria-label={`Theme: ${theme}`} />;
}
