"use client";

import { Button } from "@nocoo/basalt/components/button";
import { useTheme } from "@nocoo/basalt/providers/theme";
import { Monitor, Moon, Sun } from "lucide-react";
import { HeaderTooltip } from "./header-links";

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
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  return (
    <HeaderTooltip label={(nextTheme === "system" ? "Use system theme" : `Switch to ${nextTheme} theme`)}>
      <Button variant="ghost" size="icon" onClick={() => setTheme(nextTheme)} aria-label={`Theme: ${theme}`}>
        <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
      </Button>
    </HeaderTooltip>
  );
}
