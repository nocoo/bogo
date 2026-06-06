import { useNavigate, useParams } from "react-router";
import { DocumentEditor } from "@/components/document/DocumentEditor";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useDocument } from "@/viewmodels/document/use-document";
import { usePersonList } from "@/viewmodels/person/use-person-list";

export function DocumentEditorPage() {
	const { workspaceId } = useWorkspaceContext();
	const { id } = useParams<{ id: string }>();
	const vm = useDocument(id ?? "");
	const personListVM = usePersonList();
	const navigate = useNavigate();

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				Select a workspace to view documents
			</div>
		);
	}

	return (
		<DocumentEditor
			key={`${workspaceId}:${id}`}
			vm={vm}
			allPersons={personListVM.persons}
			allPersonsLoading={personListVM.isLoading}
			allPersonsError={personListVM.error}
			onBack={() => navigate("/documents")}
		/>
	);
}
