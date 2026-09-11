import { BOGO_VERSION } from "@bogo/shared";
import { LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import { ArrowUpRight, Building2, FileType, ListTree, Tags } from "lucide-react";
import { Link } from "react-router";

const SETTINGS = [
	{
		title: "Document Types",
		description: "Classify notes and records with reusable types and colors.",
		href: "/settings/doc-types",
		icon: FileType,
	},
	{
		title: "Custom Fields",
		description: "Capture the details that matter on profiles and the organization chart.",
		href: "/settings/fields",
		icon: ListTree,
	},
	{
		title: "Tags",
		description: "Organize documents and people with shared labels.",
		href: "/settings/tags",
		icon: Tags,
	},
	{
		title: "Workspaces",
		description: "Keep each organization's people and documents together.",
		href: "/workspaces",
		icon: Building2,
	},
];

export function SettingsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description="Shape your workspace around the way you organize knowledge."
			/>
			<div className="grid gap-4 md:grid-cols-2">
				{SETTINGS.map(({ title, description, href, icon: Icon }) => (
					<LayerCard
						key={href}
						padding="none"
						className="transition-shadow hover:ring-1 hover:ring-basalt-border"
					>
						<Link to={href} className="group flex h-full items-start gap-4 rounded-basalt-card p-5">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-basalt-primary/10 text-basalt-primary">
								<Icon className="h-5 w-5" strokeWidth={1.5} />
							</div>
							<div className="min-w-0 flex-1">
								<h2 className="text-sm font-semibold">{title}</h2>
								<p className="mt-1.5 text-sm leading-relaxed text-basalt-muted-foreground">
									{description}
								</p>
							</div>
							<ArrowUpRight
								className="h-4 w-4 shrink-0 text-basalt-muted-foreground group-hover:text-basalt-primary"
								strokeWidth={1.5}
							/>
						</Link>
					</LayerCard>
				))}
			</div>
			<SectionRule title="About bogo">
				<LayerCard className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-sm font-medium">
							A personal knowledge base for people and documents.
						</p>
						<p className="mt-1 text-xs text-basalt-muted-foreground">v{BOGO_VERSION}</p>
					</div>
					<a
						href="https://github.com/nocoo/bogo"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-sm text-basalt-primary hover:underline"
					>
						GitHub
						<ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
					</a>
				</LayerCard>
			</SectionRule>
		</div>
	);
}
