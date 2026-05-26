export interface TagColorTokens {
	bg: string;
	text: string;
	border: string;
}

const PRESET_COLORS: Record<string, TagColorTokens> = {
	"#ef4444": { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
	"#f97316": { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
	"#eab308": { bg: "#fefce8", text: "#854d0e", border: "#fef08a" },
	"#22c55e": { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
	"#14b8a6": { bg: "#f0fdfa", text: "#115e59", border: "#99f6e4" },
	"#3b82f6": { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
	"#6366f1": { bg: "#eef2ff", text: "#3730a3", border: "#c7d2fe" },
	"#8b5cf6": { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" },
	"#ec4899": { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8" },
	"#06b6d4": { bg: "#ecfeff", text: "#155e75", border: "#a5f3fc" },
	"#84cc16": { bg: "#f7fee7", text: "#3f6212", border: "#d9f99d" },
	"#f43f5e": { bg: "#fff1f2", text: "#9f1239", border: "#fecdd3" },
};

const FALLBACK: TagColorTokens = { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" };

export const PRESET_HEX_VALUES = Object.keys(PRESET_COLORS);

export function getTagColors(hex: string | null): TagColorTokens {
	if (!hex) {
		return FALLBACK;
	}
	const preset = PRESET_COLORS[hex.toLowerCase()];
	if (preset) {
		return preset;
	}
	return computeTokens(hex);
}

function parseHex(hex: string): [number, number, number] {
	const h = hex.replace("#", "");
	return [
		Number.parseInt(h.slice(0, 2), 16),
		Number.parseInt(h.slice(2, 4), 16),
		Number.parseInt(h.slice(4, 6), 16),
	];
}

function blend(r: number, g: number, b: number, opacity: number): [number, number, number] {
	return [
		Math.round(r * opacity + 255 * (1 - opacity)),
		Math.round(g * opacity + 255 * (1 - opacity)),
		Math.round(b * opacity + 255 * (1 - opacity)),
	];
}

function luminance(r: number, g: number, b: number): number {
	const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(l1: number, l2: number): number {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

function darken(r: number, g: number, b: number, factor: number): [number, number, number] {
	return [Math.round(r * (1 - factor)), Math.round(g * (1 - factor)), Math.round(b * (1 - factor))];
}

function toRgb(r: number, g: number, b: number): string {
	return `rgb(${r},${g},${b})`;
}

function computeTokens(hex: string): TagColorTokens {
	const [r, g, b] = parseHex(hex);
	const bgRgb = blend(r, g, b, 0.08);
	const borderRgb = blend(r, g, b, 0.3);

	const bgLum = luminance(...bgRgb);
	let textRgb: [number, number, number] = [r, g, b];
	for (let i = 0; i < 10; i++) {
		if (contrastRatio(bgLum, luminance(...textRgb)) >= 4.5) {
			break;
		}
		textRgb = darken(...textRgb, 0.15);
	}

	return {
		bg: toRgb(...bgRgb),
		text: toRgb(...textRgb),
		border: toRgb(...borderRgb),
	};
}
