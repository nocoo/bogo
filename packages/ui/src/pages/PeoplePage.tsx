import { TagBadge } from "@/components/TagBadge";
import { TagFilter } from "@/components/TagFilter";
import { PersonTree } from "@/components/person/PersonTree";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { personModel } from "@/models/person.model";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { useState } from "react";

export function PeoplePage() {
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data: filteredPersons } = useQuery({
		...personModel.listQueryOptions(wid, selectedTags),
		enabled: !!wid && selectedTags.length > 0,
	});

	return (
		<div className="flex flex-col h-full">
			<div className="shrink-0 px-4 pt-3 pb-2">
				<TagFilter scope="person" selected={selectedTags} onChange={setSelectedTags} />
			</div>
			{selectedTags.length > 0 ? (
				<div className="flex-1 overflow-y-auto px-4 pb-4">
					{(filteredPersons ?? []).length === 0 ? (
						<p className="text-sm text-muted-foreground py-8 text-center">
							No people match the selected tags.
						</p>
					) : (
						<div className="space-y-2">
							{(filteredPersons ?? []).map((person) => (
								<div
									key={person.id}
									className="flex items-center gap-3 rounded-lg border border-border bg-secondary px-4 py-3"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
										<User className="h-4 w-4 text-primary" strokeWidth={1.5} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-foreground truncate">{person.name}</p>
										{person.title && (
											<p className="text-xs text-muted-foreground truncate">{person.title}</p>
										)}
									</div>
									{person.tags.length > 0 && (
										<div className="flex gap-1 flex-wrap">
											{person.tags.map((tag) => (
												<TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
											))}
										</div>
									)}
								</div>
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
