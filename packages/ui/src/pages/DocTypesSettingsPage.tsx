import { DocTypeManager } from "@/components/document/DocTypeManager";
import { useDocTypes } from "@/viewmodels/document/use-doc-types";

export function DocTypesSettingsPage() {
	const vm = useDocTypes();
	return <DocTypeManager vm={vm} />;
}
