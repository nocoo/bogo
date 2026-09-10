import { LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { FieldDefsManager } from "../components/field/FieldDefsManager.js";
import { useFieldDefs } from "../viewmodels/field/use-field-defs.js";

export function FieldsSettingsPage() {
	const vm = useFieldDefs();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Custom Fields"
				description="Define custom metadata fields for person profiles and org charts."
			/>
			<LayerCard>
				<FieldDefsManager vm={vm} />
			</LayerCard>
		</div>
	);
}
