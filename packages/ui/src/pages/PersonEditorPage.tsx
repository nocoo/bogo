import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { PageBackLink } from "@/components/layout/PageBackLink";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { PersonEditorForm } from "@/components/person/PersonEditorForm";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs";
import { useFieldValues } from "@/viewmodels/field/use-field-values";
import { usePersonList } from "@/viewmodels/person/use-person-list";

/** Parent list for person editor (opened from Table name click). */
const PERSON_EDITOR_PARENT = {
	to: "/table",
	ariaLabel: "Back to Table",
	label: "Table",
} as const;

/**
 * Full-page person editor at `/people/:id`.
 * Shell breadcrumbs + in-page PageBackLink (standard detail chrome).
 */
export function PersonEditorPage() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { workspaceId } = useWorkspaceContext();
	const personList = usePersonList();
	const fieldDefsVm = useFieldDefs();
	const fieldValuesVm = useFieldValues(id ?? "");

	const person = useMemo(
		() => personList.persons.find((p) => p.id === id) ?? null,
		[personList.persons, id],
	);

	if (!workspaceId) {
		return (
			<div className="py-8 text-sm text-muted-foreground">Select a workspace to edit people</div>
		);
	}

	if (personList.isLoading) {
		return (
			<div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading…
			</div>
		);
	}

	if (!person) {
		return (
			<div className="space-y-3 py-8">
				<p className="text-sm text-muted-foreground">Person not found.</p>
				<PageBackLink to={PERSON_EDITOR_PARENT.to} ariaLabel={PERSON_EDITOR_PARENT.ariaLabel}>
					{PERSON_EDITOR_PARENT.label}
				</PageBackLink>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4">
			{/* Identity row: back (left of name) + avatar + title */}
			<header className="page-toolbar shrink-0 border-b border-border/60 pb-3">
				<PageBackLink to={PERSON_EDITOR_PARENT.to} ariaLabel={PERSON_EDITOR_PARENT.ariaLabel} />
				<div className="flex min-w-0 items-center gap-3">
					<PersonAvatar name={person.name} avatarUrl={person.avatarUrl} size="lg" />
					<div className="min-w-0">
						<h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
							{person.name}
						</h1>
						{person.title ? (
							<p className="truncate text-sm text-muted-foreground">{person.title}</p>
						) : (
							<p className="truncate text-sm text-muted-foreground/70">No title</p>
						)}
					</div>
				</div>
			</header>

			<div className="min-h-0 min-w-0 flex-1">
				<PersonEditorForm
					key={person.id}
					person={person}
					persons={personList.persons}
					onUpdate={personList.update}
					onMove={personList.move}
					onRemove={(personId) => {
						personList.remove(personId);
						navigate(PERSON_EDITOR_PARENT.to);
					}}
					isRemoving={personList.isRemoving}
					fieldDefs={fieldDefsVm.defs}
					fieldValuesVm={fieldValuesVm}
					variant="page"
				/>
			</div>
		</div>
	);
}
