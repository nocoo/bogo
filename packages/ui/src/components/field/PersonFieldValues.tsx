import type { CustomFieldDefinition } from "@bogo/shared";
import { Input } from "@nocoo/basalt";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
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

	const commit = useCallback(
		(next: string) => {
			setLocalValue(next);
			if (next === currentValue) {
				setValidationError(null);
				return;
			}
			const error = vm.validate(def, next);
			if (error) {
				setValidationError(error);
				return;
			}
			setValidationError(null);
			vm.setValue(def.id, next);
		},
		[currentValue, def, vm],
	);

	const handleBlur = useCallback(() => {
		commit(localValue);
	}, [commit, localValue]);

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
				onCommit={commit}
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
	onCommit,
	onBlur,
}: {
	id: string;
	def: CustomFieldDefinition;
	value: string;
	onChange: (value: string) => void;
	onCommit: (value: string) => void;
	onBlur: () => void;
}) {
	switch (def.fieldType) {
		case "boolean":
			return (
				<Select
					value={value === "" ? "\u0000" : value}
					onValueChange={(next) => onCommit(next === "\u0000" ? "" : next)}
				>
					<SelectTrigger id={id} className="mt-1 w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={"\u0000"}>—</SelectItem>
						<SelectItem value="true">Yes</SelectItem>
						<SelectItem value="false">No</SelectItem>
					</SelectContent>
				</Select>
			);
		case "select":
			return (
				<Select
					value={value === "" ? "\u0000" : value}
					onValueChange={(next) => onCommit(next === "\u0000" ? "" : next)}
				>
					<SelectTrigger id={id} className="mt-1 w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={"\u0000"}>—</SelectItem>
						{(def.options ?? []).map((opt) => (
							<SelectItem key={opt} value={opt}>
								{opt}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
