import { FieldDefsManager } from "../components/field/FieldDefsManager.js";
import { useFieldDefs } from "../viewmodels/field/use-field-defs.js";

export function FieldsSettingsPage() {
	const vm = useFieldDefs();

	return (
		<div className="rounded-xl bg-secondary p-5">
			<FieldDefsManager vm={vm} />
		</div>
	);
}
