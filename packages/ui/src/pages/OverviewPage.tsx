import { Button, LayerCard } from "@nocoo/basalt";
import { Empty } from "@nocoo/basalt/components/empty";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, FileText, Network, Table2 } from "lucide-react";
import { Link } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { documentModel } from "@/models/document.model";
import { personModel } from "@/models/person.model";

export function OverviewPage() {
	const { workspace, workspaceId } = useWorkspaceContext();
	const documents = useQuery(documentModel.listQueryOptions(workspaceId ?? ""));
	const people = useQuery(personModel.listQueryOptions(workspaceId ?? ""));
	const recent = [...(documents.data ?? [])]
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		.slice(0, 6);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Overview"
				description={
					workspace
						? `${workspace.name} · Your people, documents, and shared context.`
						: "A place for your people and the knowledge around them."
				}
				actions={
					<Button asChild variant="outline">
						<Link to="/workspaces">
							<Building2 className="h-4 w-4" strokeWidth={1.5} />
							Workspaces
						</Link>
					</Button>
				}
			/>
			{!workspaceId ? (
				<Empty
					icon={<Building2 />}
					title="Start with a workspace"
					description="Create or select a workspace to organize your people and documents."
					action={
						<Button asChild>
							<Link to="/workspaces">Manage workspaces</Link>
						</Button>
					}
				/>
			) : (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						{[
							{
								title: "Documents",
								href: "/documents",
								icon: FileText,
								query: documents,
								hint: "Notes, conversations, and decisions",
							},
							{
								title: "People",
								href: "/people",
								icon: Network,
								query: people,
								hint: "Profiles and reporting relationships",
							},
						].map(({ title, href, icon: Icon, query, hint }) => (
							<LayerCard
								key={href}
								padding="none"
								className="transition-shadow hover:ring-1 hover:ring-basalt-border"
							>
								<Link
									to={href}
									className="group flex items-start justify-between gap-4 rounded-basalt-card p-5"
								>
									<div className="min-w-0">
										<p className="flex items-center gap-2 text-sm text-basalt-muted-foreground">
											<Icon className="h-4 w-4" strokeWidth={1.5} />
											{title}
										</p>
										<p className="my-3 text-3xl font-semibold tracking-tight tabular-nums">
											{query.isLoading || query.isError ? "—" : (query.data?.length ?? 0)}
										</p>
										<p className="text-xs text-basalt-muted-foreground">
											{query.isError ? "Could not load this collection" : hint}
										</p>
									</div>
									<ArrowUpRight
										className="h-4 w-4 text-basalt-muted-foreground transition-colors group-hover:text-basalt-primary"
										strokeWidth={1.5}
									/>
								</Link>
							</LayerCard>
						))}
					</div>
					<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
						<SectionRule
							title="Recent documents"
							actions={
								<Button asChild variant="ghost" size="sm">
									<Link to="/documents">
										View all
										<ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
									</Link>
								</Button>
							}
						>
							<LayerCard padding="none">
								{documents.isLoading ? (
									<LayerCard.Loading label="Loading documents" />
								) : documents.isError ? (
									<p role="alert" className="p-5 text-sm text-basalt-danger">
										Could not load recent documents.
									</p>
								) : recent.length === 0 ? (
									<Empty
										title="No documents yet"
										description="Keep your first note, decision, or conversation here."
									/>
								) : (
									<ul className="divide-y divide-basalt-border/60">
										{recent.map((doc) => (
											<li key={doc.id}>
												<Link
													to={`/documents/${doc.id}`}
													className="flex items-center gap-3 rounded-lg px-4 py-4 transition-colors hover:bg-basalt-accent/50"
												>
													<FileText
														className="h-4 w-4 shrink-0 text-basalt-muted-foreground"
														strokeWidth={1.5}
													/>
													<div className="min-w-0 flex-1">
														<p className="truncate text-sm font-medium">{doc.title}</p>
														<p className="mt-1 text-xs text-basalt-muted-foreground">
															Updated {new Date(doc.updatedAt).toLocaleDateString()}
														</p>
													</div>
													<ArrowUpRight
														className="h-4 w-4 shrink-0 text-basalt-muted-foreground"
														strokeWidth={1.5}
													/>
												</Link>
											</li>
										))}
									</ul>
								)}
							</LayerCard>
						</SectionRule>
						<SectionRule
							title="People"
							actions={
								<Button asChild variant="ghost" size="sm">
									<Link to="/table">
										<Table2 className="h-4 w-4" strokeWidth={1.5} />
										Table view
									</Link>
								</Button>
							}
						>
							<LayerCard padding="none">
								{people.isLoading ? (
									<LayerCard.Loading label="Loading people" />
								) : people.isError ? (
									<p role="alert" className="p-5 text-sm text-basalt-danger">
										Could not load people.
									</p>
								) : !people.data?.length ? (
									<Empty title="No people yet" description="Your organization will appear here." />
								) : (
									<ul className="divide-y divide-basalt-border/60">
										{people.data.slice(0, 5).map((person) => (
											<li key={person.id}>
												<Link
													to={`/people/${person.id}`}
													className="flex items-center gap-3 rounded-lg p-4 transition-colors hover:bg-basalt-accent/50"
												>
													<PersonAvatar name={person.name} avatarUrl={person.avatarUrl} size="lg" />
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">{person.name}</p>
														<p className="mt-0.5 truncate text-xs text-basalt-muted-foreground">
															{person.title || "View profile"}
														</p>
													</div>
												</Link>
											</li>
										))}
									</ul>
								)}
							</LayerCard>
						</SectionRule>
					</div>
				</>
			)}
		</div>
	);
}
