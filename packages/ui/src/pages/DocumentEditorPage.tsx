import { DocumentEditor } from "@/components/document/DocumentEditor";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { personModel } from "@/models/person.model";
import { useDocument } from "@/viewmodels/document/use-document";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";

export function DocumentEditorPage() {
	const { workspaceId } = useWorkspaceContext();
	const { id } = useParams<{ id: string }>();
	const vm = useDocument(id ?? "");
	const navigate = useNavigate();
	const { data: allPersons } = useQuery(personModel.listQueryOptions(workspaceId ?? ""));

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
			allPersons={allPersons ?? []}
			onBack={() => navigate("/documents")}
		/>
	);
}
