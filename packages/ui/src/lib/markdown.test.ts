import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown.js";

describe("renderMarkdown", () => {
	it("renders headings", () => {
		expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
		expect(renderMarkdown("## Sub")).toBe("<h2>Sub</h2>");
		expect(renderMarkdown("### H3")).toBe("<h3>H3</h3>");
	});

	it("renders bold and italic", () => {
		expect(renderMarkdown("**bold**")).toBe("<strong>bold</strong>");
		expect(renderMarkdown("*italic*")).toBe("<em>italic</em>");
	});

	it("renders inline code", () => {
		expect(renderMarkdown("`code`")).toBe("<code>code</code>");
	});

	it("renders list items", () => {
		expect(renderMarkdown("- item")).toBe("<li>item</li>");
		expect(renderMarkdown("* item")).toBe("<li>item</li>");
	});

	it("renders safe links (http/https)", () => {
		expect(renderMarkdown("[link](https://example.com)")).toBe(
			'<a href="https://example.com">link</a>',
		);
		expect(renderMarkdown("[link](http://example.com)")).toBe(
			'<a href="http://example.com">link</a>',
		);
	});

	it("renders mailto links", () => {
		expect(renderMarkdown("[email](mailto:test@example.com)")).toBe(
			'<a href="mailto:test@example.com">email</a>',
		);
	});

	it("renders relative path links", () => {
		expect(renderMarkdown("[page](/about)")).toBe('<a href="/about">page</a>');
		expect(renderMarkdown("[file](./doc.pdf)")).toBe('<a href="./doc.pdf">file</a>');
	});

	it("rejects javascript: protocol links", () => {
		expect(renderMarkdown("[xss](javascript:alert)")).toBe("xss");
		expect(renderMarkdown("[xss](JAVASCRIPT:alert)")).toBe("xss");
		expect(renderMarkdown("[xss](javascript:void%280%29)")).toBe("xss");
	});

	it("rejects data: protocol links", () => {
		expect(renderMarkdown("[xss](data:text/html,hello)")).toBe("xss");
	});

	it("escapes raw HTML tags", () => {
		expect(renderMarkdown("<script>alert(1)</script>")).toBe(
			"&lt;script&gt;alert(1)&lt;/script&gt;",
		);
		expect(renderMarkdown('<img onerror="alert(1)" src=x>')).toBe(
			"&lt;img onerror=&quot;alert(1)&quot; src=x&gt;",
		);
	});

	it("escapes HTML in heading content", () => {
		expect(renderMarkdown("# <b>hello</b>")).toBe("<h1>&lt;b&gt;hello&lt;/b&gt;</h1>");
	});

	it("escapes HTML entities in normal text", () => {
		expect(renderMarkdown("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
	});

	it("converts newlines to br", () => {
		expect(renderMarkdown("line1\nline2")).toBe("line1<br>line2");
	});

	it("handles combined markdown correctly", () => {
		const input = "# Hello\n**bold text**\n[safe](https://ok.com)";
		const result = renderMarkdown(input);
		expect(result).toContain("<h1>Hello</h1>");
		expect(result).toContain("<strong>bold text</strong>");
		expect(result).toContain('<a href="https://ok.com">safe</a>');
	});
});
