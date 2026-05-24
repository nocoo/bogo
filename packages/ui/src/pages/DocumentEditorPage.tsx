import { DocumentEditor } from "@/components/document/DocumentEditor";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useDocument } from "@/viewmodels/document/use-document";
import { useNavigate, useParams } from "react-router";

export function DocumentEditorPage() {
	const { workspaceId } = useWorkspaceContext();
	const { id } = useParams<{ id: string }>();
	const vm = useDocument(id ?? "");
	const navigate = useNavigate();

	if (!workspaceId) {
		return (
			<div className="flex items-center justify-center py-12 text-muted-foreground">
				Select a workspace to view documents
			</div>
		);
	}

	return (
		<DocumentEditor key={`${workspaceId}:${id}`} vm={vm} onBack={() => navigate("/documents")} />
	);
}
