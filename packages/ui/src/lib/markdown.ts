// ---------------------------------------------------------------------------
// Markdown → HTML renderer (client-side, used by document preview)
// Uses `marked` with a custom renderer that escapes raw HTML and sanitises URLs.
// ---------------------------------------------------------------------------

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

/**
 * Render markdown to a trusted HTML string.
 * - Raw HTML is escaped (XSS-safe)
 * - URLs are restricted to a safe scheme allowlist
 * - External links open in a new tab with rel="noopener noreferrer"
 * - Headings get auto-generated `id` anchors
 */
export function renderMarkdown(src: string): string {
	if (!src) return "";
	const result = getMarked().parse(src, { async: false });
	return (typeof result === "string" ? result : "").trim();
}
