import { FieldDefsManager } from "@/components/field/FieldDefsManager";
import { useFieldDefs } from "@/viewmodels/field/use-field-defs";

export function FieldsSettingsPage() {
	const vm = useFieldDefs();
	return <FieldDefsManager vm={vm} />;
}
