import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FieldDefsManager } from "../components/field/FieldDefsManager.js";
import { useFieldDefs } from "../viewmodels/field/use-field-defs.js";

export function FieldsSettingsPage() {
	const vm = useFieldDefs();
	const [showCreate, setShowCreate] = useState(false);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Custom Fields"
				description="Define custom metadata fields for person profiles and org charts."
				actions={
					<Button
						onClick={() => setShowCreate(true)}
						disabled={showCreate}
						aria-label="Add field definition"
					>
						<Plus className="h-4 w-4" strokeWidth={2} />
						Add Field
					</Button>
				}
			/>
			<LayerCard>
				<FieldDefsManager
					vm={vm}
					showHeader={false}
					showCreateOverride={showCreate}
					setShowCreateOverride={setShowCreate}
				/>
			</LayerCard>
		</div>
	);
}
