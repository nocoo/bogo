import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.js";

describe("renderMarkdown", () => {
	it("returns empty string for empty input", () => {
		expect(renderMarkdown("")).toBe("");
	});

	it("wraps paragraphs", () => {
		expect(renderMarkdown("hello")).toBe("<p>hello</p>");
	});

	it("renders headings with id anchors", () => {
		expect(renderMarkdown("# Title")).toBe('<h1 id="title">Title</h1>');
		expect(renderMarkdown("## Sub Section")).toBe('<h2 id="sub-section">Sub Section</h2>');
		expect(renderMarkdown("###### Deep")).toBe('<h6 id="deep">Deep</h6>');
	});

	it("renders bold inside a paragraph", () => {
		expect(renderMarkdown("**bold**")).toBe("<p><strong>bold</strong></p>");
	});

	it("renders italic inside a paragraph", () => {
		expect(renderMarkdown("*italic*")).toBe("<p><em>italic</em></p>");
	});

	it("renders inline code", () => {
		expect(renderMarkdown("`code`")).toBe("<p><code>code</code></p>");
	});

	it("renders fenced code blocks with language class", () => {
		const result = renderMarkdown("```ts\nconst x = 1;\n```");
		expect(result).toContain('<pre><code class="language-ts">const x = 1;');
		expect(result).toContain("</code></pre>");
	});

	it("escapes html inside code blocks", () => {
		const result = renderMarkdown("```\n<script>alert(1)</script>\n```");
		expect(result).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	it("renders unordered lists wrapped in ul", () => {
		const result = renderMarkdown("- a\n- b");
		expect(result).toMatch(/^<ul>/);
		expect(result).toContain("<li>a</li>");
		expect(result).toContain("<li>b</li>");
		expect(result).toMatch(/<\/ul>$/);
	});

	it("renders ordered lists wrapped in ol", () => {
		const result = renderMarkdown("1. one\n2. two");
		expect(result).toMatch(/^<ol[^>]*>/);
		expect(result).toContain("<li>one</li>");
		expect(result).toContain("<li>two</li>");
	});

	it("renders blockquotes", () => {
		const result = renderMarkdown("> quoted");
		expect(result).toContain("<blockquote>");
		expect(result).toContain("quoted");
	});

	it("renders tables (GFM)", () => {
		const result = renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
		expect(result).toContain("<table>");
		expect(result).toContain("<th>a</th>");
		expect(result).toContain("<td>1</td>");
	});

	it("renders safe links (http/https) with target=_blank", () => {
		const result = renderMarkdown("[link](https://example.com)");
		expect(result).toContain('href="https://example.com"');
		expect(result).toContain('target="_blank"');
		expect(result).toContain('rel="noopener noreferrer"');
	});

	it("renders mailto links without target=_blank", () => {
		const result = renderMarkdown("[email](mailto:test@example.com)");
		expect(result).toContain('href="mailto:test@example.com"');
		expect(result).not.toContain("target=");
	});

	it("renders relative path links without target=_blank", () => {
		const result = renderMarkdown("[page](/about)");
		expect(result).toContain('href="/about"');
		expect(result).not.toContain("target=");
	});

	it("renders bare relative path links", () => {
		const result = renderMarkdown("[file](page.html)");
		expect(result).toContain('href="page.html"');
	});

	it("renders hash anchor links", () => {
		const result = renderMarkdown("[top](#intro)");
		expect(result).toContain('href="#intro"');
	});

	it("renders tel: links", () => {
		const result = renderMarkdown("[call](tel:+15551234)");
		expect(result).toContain('href="tel:+15551234"');
	});

	it("rejects javascript: protocol links (renders only the text)", () => {
		expect(renderMarkdown("[xss](javascript:alert)")).toBe("<p>xss</p>");
		expect(renderMarkdown("[xss](JAVASCRIPT:alert)")).toBe("<p>xss</p>");
	});

	it("rejects data: protocol links", () => {
		expect(renderMarkdown("[xss](data:text/html,hello)")).toBe("<p>xss</p>");
	});

	it("rejects vbscript: protocol links", () => {
		expect(renderMarkdown("[xss](vbscript:msgbox)")).toBe("<p>xss</p>");
	});

	it("escapes raw HTML tags", () => {
		const result = renderMarkdown("<script>alert(1)</script>");
		expect(result).toContain("&lt;script&gt;");
		expect(result).not.toContain("<script>");
	});

	it("escapes inline raw HTML", () => {
		const result = renderMarkdown('plain <img onerror="alert(1)" src=x> text');
		expect(result).not.toContain("<img");
		expect(result).toContain("&lt;img");
	});

	it("escapes HTML entities in normal text", () => {
		expect(renderMarkdown("a < b & c > d")).toBe("<p>a &lt; b &amp; c &gt; d</p>");
	});

	it("renders images with lazy loading and alt", () => {
		const result = renderMarkdown("![cat](https://example.com/cat.png)");
		expect(result).toContain('src="https://example.com/cat.png"');
		expect(result).toContain('alt="cat"');
		expect(result).toContain('loading="lazy"');
	});

	it("renders images with title attribute and falls back to title for alt", () => {
		const result = renderMarkdown('![](https://example.com/x.png "tooltip")');
		expect(result).toContain('title="tooltip"');
		expect(result).toContain('alt="tooltip"');
	});

	it("renders images with empty alt when no text or title", () => {
		const result = renderMarkdown("![](https://example.com/x.png)");
		expect(result).toContain('alt=""');
	});

	it("rejects images with dangerous schemes", () => {
		const result = renderMarkdown("![x](javascript:alert)");
		expect(result).not.toContain("<img");
	});

	it("handles combined markdown correctly", () => {
		const input = "# Hello\n\n**bold text** and [safe](https://ok.com)";
		const result = renderMarkdown(input);
		expect(result).toContain('<h1 id="hello">Hello</h1>');
		expect(result).toContain("<strong>bold text</strong>");
		expect(result).toContain('href="https://ok.com"');
	});
});

describe("renderMarkdown — YAML frontmatter", () => {
	it("renders frontmatter as a property table and strips the source block", () => {
		const input = "---\nname: Shizhe\nstatus: Posted\n---\n\n# Body";
		const result = renderMarkdown(input);
		expect(result).toContain('<table class="markdown-frontmatter">');
		expect(result).toContain('<th scope="row">name</th>');
		expect(result).toContain("<td>Shizhe</td>");
		expect(result).toContain('<th scope="row">status</th>');
		expect(result).toContain('<h1 id="body">Body</h1>');
		// the raw fence delimiters should not leak into the body
		expect(result).not.toContain("<hr>");
	});

	it("renders array values as chips", () => {
		const input = "---\ntags: [a, b, c]\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain('<span class="markdown-frontmatter-chip">a</span>');
		expect(result).toContain('<span class="markdown-frontmatter-chip">b</span>');
		expect(result).toContain('<span class="markdown-frontmatter-chip">c</span>');
	});

	it("renders empty arrays / null / undefined as em-dash", () => {
		const input = "---\nempty_arr: []\nempty_val:\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain('<span class="markdown-frontmatter-empty">—</span>');
	});

	it("renders numbers and booleans as text", () => {
		const input = "---\ncount: 42\nactive: true\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain("<td>42</td>");
		expect(result).toContain("<td>true</td>");
	});

	it("escapes HTML inside frontmatter values", () => {
		const input = "---\nname: <script>alert(1)</script>\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain("&lt;script&gt;");
		expect(result).not.toContain("<script>");
	});

	it("escapes HTML inside frontmatter keys", () => {
		const input = '---\n"<bad>": value\n---\nbody';
		const result = renderMarkdown(input);
		expect(result).toContain("&lt;bad&gt;");
	});

	it("silently strips malformed YAML frontmatter", () => {
		const input = "---\nname: : : invalid\n---\n\n# Body";
		const result = renderMarkdown(input);
		expect(result).not.toContain('<table class="markdown-frontmatter">');
		expect(result).not.toContain("name");
		expect(result).toContain('<h1 id="body">Body</h1>');
	});

	it("silently strips frontmatter whose YAML is a scalar (not a mapping)", () => {
		const input = "---\nplain string\n---\n\n# Body";
		const result = renderMarkdown(input);
		expect(result).not.toContain('<table class="markdown-frontmatter">');
		expect(result).toContain('<h1 id="body">Body</h1>');
	});

	it("does not treat mid-document --- fences as frontmatter", () => {
		const input = "# Title\n\nbody\n\n---\nname: x\n---";
		const result = renderMarkdown(input);
		expect(result).not.toContain('<table class="markdown-frontmatter">');
		expect(result).toContain('<h1 id="title">Title</h1>');
	});

	it("handles CRLF line endings in frontmatter", () => {
		const input = "---\r\nname: Shizhe\r\n---\r\n\r\n# Body";
		const result = renderMarkdown(input);
		expect(result).toContain('<th scope="row">name</th>');
		expect(result).toContain('<h1 id="body">Body</h1>');
	});

	it("renders frontmatter with no body", () => {
		const input = "---\nname: x\n---\n";
		const result = renderMarkdown(input);
		expect(result).toContain('<th scope="row">name</th>');
	});

	it("preserves date-like strings verbatim (no auto Date coercion)", () => {
		const input = "---\nfetched_at: 2026-05-30\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain("<td>2026-05-30</td>");
		expect(result).not.toContain("T00:00:00");
	});

	it("renders nested objects as inline JSON code", () => {
		const input = "---\nmeta:\n  key: value\n  count: 3\n---\nbody";
		const result = renderMarkdown(input);
		expect(result).toContain("<code>");
		expect(result).toContain("&quot;key&quot;:&quot;value&quot;");
		expect(result).toContain("&quot;count&quot;:3");
	});

	it("renders a realistic Connect document sample", () => {
		const input = `---
name: Shizhe Huang
pernr: 6259965
connect_name: "Connect Apr 2026"
period: "Nov 27, 2025 - Apr 14, 2026"
status: Posted
tags: [connect, performance, shizhe]
---

# Connect Apr 2026 — Shizhe Huang

**Reflection Period:** Nov 27, 2025
`;
		const result = renderMarkdown(input);
		expect(result).toContain('<table class="markdown-frontmatter">');
		expect(result).toContain('<th scope="row">name</th>');
		expect(result).toContain("<td>Shizhe Huang</td>");
		expect(result).toContain("<td>Connect Apr 2026</td>");
		expect(result).toContain('<span class="markdown-frontmatter-chip">connect</span>');
		expect(result).toContain('<h1 id="connect-apr-2026-shizhe-huang">');
		// Ensure none of the raw frontmatter keys leak into the rendered body
		expect(result).not.toContain("<p>name: Shizhe");
		expect(result).not.toContain("<p>pernr:");
	});
});
