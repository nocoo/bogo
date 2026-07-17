import type { CustomFieldDefinition, Person, UpdatePersonInput } from "@bogo/shared";
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
		<div className="w-80 max-h-[min(85vh,40rem)] overflow-y-auto rounded-xl bg-secondary p-4 shadow-lg ring-1 ring-border/60">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">Edit Person</h3>
				<button
					type="button"
					onClick={onClose}
					className="btn-icon h-7 w-7"
					aria-label="Close edit panel"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</button>
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
		</div>
	);
}
