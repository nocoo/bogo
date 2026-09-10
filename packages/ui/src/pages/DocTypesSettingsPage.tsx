import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Plus } from "lucide-react";
import { useState } from "react";
import { DocTypeManager } from "../components/document/DocTypeManager.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";

export function DocTypesSettingsPage() {
	const vm = useDocTypes();
	const [showCreate, setShowCreate] = useState(false);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Document Types"
				description="Manage document classifications, color coding, and sorting."
				actions={
					<Button
						onClick={() => setShowCreate(true)}
						disabled={showCreate}
						aria-label="Add document type"
					>
						<Plus className="h-4 w-4" strokeWidth={2} />
						Add Type
					</Button>
				}
			/>
			<LayerCard>
				<DocTypeManager
					vm={vm}
					showHeader={false}
					showCreateOverride={showCreate}
					setShowCreateOverride={setShowCreate}
				/>
			</LayerCard>
		</div>
	);
}
