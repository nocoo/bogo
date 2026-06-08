// ---------------------------------------------------------------------------
// Markdown → HTML renderer (client-side, used by document preview)
// Uses `marked` with a custom renderer that escapes raw HTML and sanitises URLs.
// Detects YAML frontmatter (--- ... ---) at the top of the document and
// renders it as a structured property table; falls back to silent strip if
// the YAML payload fails to parse.
// ---------------------------------------------------------------------------

import jsYaml from "js-yaml";
import { Marked, type MarkedExtension, type Tokens } from "marked";

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttr(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** Allow only safe URL schemes; returns null for dangerous ones. */
function sanitizeUrl(url: string): string | null {
	const trimmed = url.trim();
	if (
		trimmed.startsWith("/") ||
		trimmed.startsWith("#") ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("mailto:") ||
		trimmed.startsWith("tel:")
	) {
		return trimmed;
	}
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
		return null;
	}
	return trimmed;
}

function createRenderer(): MarkedExtension {
	return {
		renderer: {
			heading(
				this: { parser: { parseInline: (t: Tokens.Generic[]) => string } },
				{ tokens, depth }: Tokens.Heading,
			): string {
				const rendered = this.parser.parseInline(tokens);
				const id = rendered
					.toLowerCase()
					.replace(/<[^>]+>/g, "")
					.replace(/[^a-z0-9一-鿿]+/g, "-")
					.replace(/^-|-$/g, "");
				return `<h${depth} id="${id}">${rendered}</h${depth}>\n`;
			},

			link(
				this: { parser: { parseInline: (t: Tokens.Generic[]) => string } },
				{ href, tokens }: Tokens.Link,
			): string {
				const safeHref = sanitizeUrl(href);
				const rendered = this.parser.parseInline(tokens);
				if (!safeHref) return rendered;

				const isExternal = safeHref.startsWith("http://") || safeHref.startsWith("https://");
				const attrs = isExternal ? ` target="_blank" rel="noopener noreferrer"` : "";
				return `<a href="${escapeAttr(safeHref)}"${attrs}>${rendered}</a>`;
			},

			image({ href, text, title }: Tokens.Image): string {
				const safeHref = sanitizeUrl(href);
				if (!safeHref) return "";
				const alt = ` alt="${escapeAttr(text || title || "")}"`;
				const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
				return `<img src="${escapeAttr(safeHref)}"${alt}${titleAttr} loading="lazy">`;
			},

			code({ text, lang }: Tokens.Code): string {
				const escaped = escapeHtml(text);
				const langClass = lang ? ` class="language-${escapeAttr(lang)}"` : "";
				return `<pre><code${langClass}>${escaped}</code></pre>\n`;
			},

			html(token: Tokens.HTML | Tokens.Tag): string {
				return escapeHtml(token.text);
			},
		},
	};
}

let instance: Marked | null = null;

function getMarked(): Marked {
	if (!instance) {
		instance = new Marked(createRenderer());
	}
	return instance;
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

/**
 * Matches a YAML frontmatter block at the very start of the document.
 * Permits an optional UTF-8 BOM and trailing newline after the closing `---`.
 */
const FRONTMATTER_RE = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

interface ExtractResult {
	frontmatterHtml: string;
	body: string;
}

function extractFrontmatter(src: string): ExtractResult {
	const match = src.match(FRONTMATTER_RE);
	if (!match) return { frontmatterHtml: "", body: src };

	const yamlText = match[1];
	const body = src.slice(match[0].length);

	let data: unknown;
	try {
		data = jsYaml.load(yamlText);
	} catch {
		// Malformed YAML — silently strip the block so it doesn't pollute the
		// rendered preview as raw text or accidental setext headings.
		return { frontmatterHtml: "", body };
	}

	if (!data || typeof data !== "object" || Array.isArray(data)) {
		return { frontmatterHtml: "", body };
	}

	return { frontmatterHtml: renderFrontmatter(data as Record<string, unknown>), body };
}

function renderFrontmatter(data: Record<string, unknown>): string {
	const entries = Object.entries(data);
	if (entries.length === 0) return "";

	const rows = entries
		.map(([key, value]) => {
			const k = escapeHtml(key);
			const v = formatFrontmatterValue(value);
			return `<tr><th scope="row">${k}</th><td>${v}</td></tr>`;
		})
		.join("");

	return `<table class="markdown-frontmatter"><tbody>${rows}</tbody></table>\n`;
}

function formatFrontmatterValue(value: unknown): string {
	if (value === null || value === undefined) {
		return `<span class="markdown-frontmatter-empty">—</span>`;
	}
	if (typeof value === "string") {
		return escapeHtml(value);
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return escapeHtml(String(value));
	}
	if (value instanceof Date) {
		return escapeHtml(value.toISOString());
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return `<span class="markdown-frontmatter-empty">—</span>`;
		return value
			.map(
				(item) => `<span class="markdown-frontmatter-chip">${formatFrontmatterValue(item)}</span>`,
			)
			.join(" ");
	}
	if (typeof value === "object") {
		// Nested objects — render as a compact JSON snippet rather than recurse.
		return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
	}
	// Symbol / function would only appear if a caller bypassed YAML; not reachable from js-yaml output.
	return escapeHtml(String(value));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render markdown to a trusted HTML string.
 * - Raw HTML is escaped (XSS-safe)
 * - URLs are restricted to a safe scheme allowlist
 * - External links open in a new tab with rel="noopener noreferrer"
 * - Headings get auto-generated `id` anchors
 * - YAML frontmatter (--- ... ---) at the top is parsed into a property table;
 *   malformed YAML is silently stripped.
 */
export function renderMarkdown(src: string): string {
	if (!src) return "";
	const { frontmatterHtml, body } = extractFrontmatter(src);
	const bodyResult = getMarked().parse(body, { async: false });
	const bodyHtml = typeof bodyResult === "string" ? bodyResult : "";
	return (frontmatterHtml + bodyHtml).trim();
}
