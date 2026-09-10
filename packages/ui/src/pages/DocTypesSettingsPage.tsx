import { LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { DocTypeManager } from "../components/document/DocTypeManager.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";

export function DocTypesSettingsPage() {
	const vm = useDocTypes();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Document Types"
				description="Manage document classifications, color coding, and sorting."
			/>
			<LayerCard>
				<DocTypeManager vm={vm} />
			</LayerCard>
		</div>
	);
}
