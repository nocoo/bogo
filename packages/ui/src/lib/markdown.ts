function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function isSafeUrl(url: string): boolean {
	const trimmed = url.trim();
	if (/^https?:\/\//i.test(trimmed)) {
		return true;
	}
	if (/^mailto:/i.test(trimmed)) {
		return true;
	}
	if (!trimmed.includes(":")) {
		return true;
	}
	return false;
}

const RULES: [RegExp, string][] = [
	[/^######\s+(.+)$/gm, "<h6>$1</h6>"],
	[/^#####\s+(.+)$/gm, "<h5>$1</h5>"],
	[/^####\s+(.+)$/gm, "<h4>$1</h4>"],
	[/^###\s+(.+)$/gm, "<h3>$1</h3>"],
	[/^##\s+(.+)$/gm, "<h2>$1</h2>"],
	[/^#\s+(.+)$/gm, "<h1>$1</h1>"],
	[/\*\*(.+?)\*\*/g, "<strong>$1</strong>"],
	[/\*(.+?)\*/g, "<em>$1</em>"],
	[/`([^`]+)`/g, "<code>$1</code>"],
	[/^\- (.+)$/gm, "<li>$1</li>"],
	[/^\* (.+)$/gm, "<li>$1</li>"],
];

export function renderMarkdown(src: string): string {
	let html = escapeHtml(src);
	for (const [re, replacement] of RULES) {
		html = html.replace(re, replacement);
	}
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
		if (isSafeUrl(url)) {
			return `<a href="${url}">${text}</a>`;
		}
		return text;
	});
	html = html.replace(/\n/g, "<br>");
	return html;
}
