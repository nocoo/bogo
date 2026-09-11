import type { CustomFieldDefinition, Person, UpdatePersonInput } from "@bogo/shared";
import { Button, LayerCard } from "@nocoo/basalt";
import { X } from "lucide-react";
import type { FieldValuesVM } from "../../viewmodels/field/use-field-values.js";
import { PersonEditorForm } from "./PersonEditorForm.js";

/**
 * Compact floating editor used on the org chart. Full-page editing lives at
 * `/people/:id` via PersonEditorPage.
 */
export function EditPersonPanel({
	person,
	persons,
	onUpdate,
	onMove,
	onRemove,
	onClose,
	isRemoving,
	fieldDefs,
	fieldValuesVm,
}: {
	person: Person;
	persons: Person[];
	onUpdate: (id: string, fields: UpdatePersonInput) => void;
	onMove: (id: string, newManagerId: string | null) => void;
	onRemove: (id: string) => void;
	onClose: () => void;
	isRemoving: boolean;
	fieldDefs?: CustomFieldDefinition[];
	fieldValuesVm?: FieldValuesVM;
}) {
	return (
		<LayerCard className="w-full shrink-0 p-4 shadow-lg sm:w-80">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-basalt-foreground">Edit Person</h3>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-7 w-7 text-basalt-muted-foreground hover:text-basalt-foreground"
					aria-label="Close edit panel"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</Button>
			</div>

			<PersonEditorForm
				person={person}
				persons={persons}
				onUpdate={onUpdate}
				onMove={onMove}
				onRemove={onRemove}
				isRemoving={isRemoving}
				fieldDefs={fieldDefs}
				fieldValuesVm={fieldValuesVm}
				variant="panel"
			/>
		</LayerCard>
	);
}
