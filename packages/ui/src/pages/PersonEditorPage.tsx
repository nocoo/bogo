import { ArrowLeft, Loader2 } from "lucide-react";
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
 * Reuses PersonEditorForm (same fields as the chart side panel) in page layout.
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

	const goBack = () => {
		// Prefer history back when we came from Table; fall back to /table
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			navigate("/table");
		}
	};

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
				Select a workspace to edit people
			</div>
		);
	}

	if (personList.isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!person) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 py-16">
				<p className="text-sm text-muted-foreground">Person not found.</p>
				<button type="button" className="btn-secondary" onClick={() => navigate("/people")}>
					Back to People
				</button>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
			{/* Header */}
			<header className="page-toolbar border-b border-border/60 pb-3">
				<button type="button" className="btn-ghost" onClick={goBack} aria-label="Go back">
					<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
					Back
				</button>
				<div className="ml-1 flex min-w-0 items-center gap-3">
					<PersonAvatar name={person.name} avatarUrl={person.avatarUrl} size="lg" />
					<div className="min-w-0">
						<h1 className="truncate text-base font-semibold text-foreground">{person.name}</h1>
						{person.title ? (
							<p className="truncate text-xs text-muted-foreground">{person.title}</p>
						) : null}
					</div>
				</div>
			</header>

			{/* Form */}
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
	);
}
