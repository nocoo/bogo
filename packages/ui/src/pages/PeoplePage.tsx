import { LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { PersonHover } from "@/components/person/PersonHover";
import { PersonTree } from "@/components/person/PersonTree";
import { TagBadge } from "@/components/TagBadge";
import { TagFilter } from "@/components/TagFilter";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { personModel } from "@/models/person.model";

export function PeoplePage() {
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data: filteredPersons } = useQuery({
		...personModel.listQueryOptions(wid, selectedTags),
		enabled: !!wid && selectedTags.length > 0,
	});

	return (
		<div className="flex h-full min-h-[36rem] min-w-0 flex-col gap-4">
			<PageHeader
				title="People"
				description="Organization chart, reporting lines, and personnel directory."
			/>
			<div className="shrink-0 pb-1">
				<TagFilter scope="person" selected={selectedTags} onChange={setSelectedTags} />
			</div>
			{selectedTags.length > 0 ? (
				<div className="flex-1 overflow-y-auto pb-4">
					{(filteredPersons ?? []).length === 0 ? (
						<p className="text-sm text-basalt-muted-foreground py-8 text-center">
							No people match the selected tags.
						</p>
					) : (
						<div className="space-y-2">
							{(filteredPersons ?? []).map((person) => (
								<LayerCard key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
									<PersonHover personId={person.id}>
										<Link
											to={`/people/${person.id}`}
											className="flex min-w-0 flex-1 items-center gap-3"
										>
											<PersonAvatar name={person.name} avatarUrl={person.avatarUrl} size="lg" />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-basalt-foreground truncate">
													{person.name}
												</p>
												{person.title && (
													<p className="text-xs text-basalt-muted-foreground truncate">
														{person.title}
													</p>
												)}
											</div>
										</Link>
									</PersonHover>
									{person.tags.length > 0 && (
										<div className="flex gap-1 flex-wrap">
											{person.tags.map((tag) => (
												<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
											))}
										</div>
									)}
								</LayerCard>
							))}
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 min-h-0">
					<PersonTree />
				</div>
			)}
		</div>
	);
}
