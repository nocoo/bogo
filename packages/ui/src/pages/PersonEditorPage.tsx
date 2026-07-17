import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { PersonEditorForm } from "@/components/person/PersonEditorForm";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs";
import { useFieldValues } from "@/viewmodels/field/use-field-values";
import { usePersonList } from "@/viewmodels/person/use-person-list";

/**
 * Full-page person editor at `/people/:id`.
 * Fills the L1 page card (same shell as Table / Documents) — left-aligned,
 * full width. Shell breadcrumbs (Home › Table › Edit person) handle navigation.
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
				<button type="button" className="btn-secondary" onClick={() => navigate("/table")}>
					Back to Table
				</button>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-4">
			{/* Page identity — sits under shell breadcrumbs, not a second nav */}
			<header className="page-toolbar shrink-0 border-b border-border/60 pb-3">
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
						navigate("/table");
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
