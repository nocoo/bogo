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
	[/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'],
];

export function renderMarkdown(src: string): string {
	let html = src;
	for (const [re, replacement] of RULES) {
		html = html.replace(re, replacement);
	}
	html = html.replace(/\n/g, "<br>");
	return html;
}
