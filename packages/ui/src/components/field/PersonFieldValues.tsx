import type { CustomFieldDefinition } from "@bogo/shared";
import { Input } from "@nocoo/basalt";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FieldValuesVM } from "../../viewmodels/field/use-field-values.js";

export function PersonFieldValues({
	defs,
	vm,
}: {
	defs: CustomFieldDefinition[];
	vm: FieldValuesVM;
}) {
	if (vm.isLoading) {
		return (
			<div className="flex items-center justify-center py-4">
				<Loader2 className="h-4 w-4 animate-spin text-basalt-muted-foreground" />
			</div>
		);
	}

	if (vm.error) {
		return (
			<div className="rounded-md bg-basalt-destructive/10 p-3 text-xs text-basalt-danger">
				Failed to load field values: {vm.error.message}
			</div>
		);
	}

	if (defs.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			{defs.map((def) => (
				<FieldValueRow key={def.id} def={def} vm={vm} />
			))}
		</div>
	);
}

function FieldValueRow({ def, vm }: { def: CustomFieldDefinition; vm: FieldValuesVM }) {
	const currentValue = vm.getValueFor(def.id);
	const [localValue, setLocalValue] = useState(currentValue);
	const [validationError, setValidationError] = useState<string | null>(null);

	useEffect(() => {
		setLocalValue(currentValue);
		setValidationError(null);
	}, [currentValue]);

	const handleBlur = useCallback(() => {
		if (localValue === currentValue) {
			return;
		}
		const error = vm.validate(def, localValue);
		if (error) {
			setValidationError(error);
			return;
		}
		setValidationError(null);
		vm.setValue(def.id, localValue);
	}, [localValue, currentValue, def, vm]);

	const handleChange = useCallback((value: string) => {
		setLocalValue(value);
		setValidationError(null);
	}, []);

	return (
		<div>
			<label htmlFor={`field-${def.id}`} className="text-xs text-basalt-muted-foreground">
				{def.name}
				{def.required && (
					<span className="text-basalt-warning ml-1" aria-hidden="true">
						*
					</span>
				)}
			</label>
			<FieldInput
				id={`field-${def.id}`}
				def={def}
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
			/>
			{validationError && (
				<p className="mt-0.5 text-xs text-basalt-danger" role="alert">
					{validationError}
				</p>
			)}
		</div>
	);
}

function FieldInput({
	id,
	def,
	value,
	onChange,
	onBlur,
}: {
	id: string;
	def: CustomFieldDefinition;
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
}) {
	const selectClass = "field-select mt-1 w-full";

	switch (def.fieldType) {
		case "boolean":
			return (
				<select
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={onBlur}
					className={selectClass}
				>
					<option value="">—</option>
					<option value="true">Yes</option>
					<option value="false">No</option>
				</select>
			);
		case "select":
			return (
				<select
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={onBlur}
					className={selectClass}
				>
					<option value="">—</option>
					{(def.options ?? []).map((opt) => (
						<option key={opt} value={opt}>
							{opt}
						</option>
					))}
				</select>
			);
		default:
			return (
				<Input
					id={id}
					type={def.fieldType}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={onBlur}
					className="mt-1 w-full"
				/>
			);
	}
}
