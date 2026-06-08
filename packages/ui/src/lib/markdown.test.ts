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
