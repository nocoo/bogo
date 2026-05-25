import { DocTypeManager } from "../components/document/DocTypeManager.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";

export function DocTypesSettingsPage() {
	const vm = useDocTypes();

	return (
		<div className="rounded-xl bg-secondary p-5">
			<DocTypeManager vm={vm} />
		</div>
	);
}
