import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageBackLink } from "@/components/layout/PageBackLink";
import { PersonEditorForm } from "@/components/person/PersonEditorForm";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs";
import { useFieldValues } from "@/viewmodels/field/use-field-values";
import { usePersonList } from "@/viewmodels/person/use-person-list";

/** Safe return path from Table (preserves ?view=). */
function tableReturnPath(from: string | null): string {
	if (!from) return "/table";
	// Only allow same-app table paths (block open redirects)
	if (from === "/table" || from.startsWith("/table?")) return from;
	return "/table";
}

/**
 * Full-page person editor at `/people/:id`.
 * Shell breadcrumbs + in-page PageBackLink (standard detail chrome).
 * Optional `?from=/table?view=<id>` restores the source view on back.
 */
export function PersonEditorPage() {
	const { id } = useParams<{ id: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { workspaceId } = useWorkspaceContext();
	const personList = usePersonList();
	const fieldDefsVm = useFieldDefs();
	const fieldValuesVm = useFieldValues(id ?? "");

	const backTo = tableReturnPath(searchParams.get("from"));

	const person = useMemo(
		() => personList.persons.find((p) => p.id === id) ?? null,
		[personList.persons, id],
	);

	if (!workspaceId) {
		return (
			<div className="py-8 text-sm text-basalt-muted-foreground">
				Select a workspace to edit people
			</div>
		);
	}

	if (personList.isLoading) {
		return (
			<div className="flex items-center gap-2 py-8 text-sm text-basalt-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading…
			</div>
		);
	}

	if (personList.error) {
		return (
			<div
				className="rounded-lg border border-basalt-destructive/25 bg-basalt-destructive/5 p-4 text-sm text-basalt-danger"
				role="alert"
			>
				Failed to load people: {personList.error.message}
			</div>
		);
	}

	if (!person) {
		return (
			<div className="space-y-3 py-8">
				<p className="text-sm text-basalt-muted-foreground">Person not found.</p>
				<PageBackLink to={backTo} ariaLabel="Back to Table">
					Table
				</PageBackLink>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<PageHeader
				title={person.name}
				description={person.title || "Profile, reporting relationships, and custom fields."}
				actions={
					<PageBackLink to={backTo} ariaLabel="Back to Table">
						Table
					</PageBackLink>
				}
			/>

			<div className="min-w-0">
				<PersonEditorForm
					key={person.id}
					person={person}
					persons={personList.persons}
					onUpdate={personList.update}
					onMove={personList.move}
					onRemove={(personId) => {
						personList.remove(personId);
						navigate(backTo);
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
