import type { CustomFieldDefinition, CustomFieldValue, FieldType } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { fieldKeys, fieldModel } from "../../models/field.model.js";

export function validateFieldValue(
	value: string,
	fieldType: FieldType,
	options: string[] | null,
): string | null {
	switch (fieldType) {
		case "number": {
			const n = Number(value);
			if (value.trim() === "" || Number.isNaN(n) || !Number.isFinite(n)) {
				return "Must be a valid finite number";
			}
			return null;
		}
		case "date": {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				return "Must be a valid date (YYYY-MM-DD)";
			}
			const [y, m, d] = value.split("-").map(Number);
			const date = new Date(y, m - 1, d);
			if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
				return "Must be a valid date (YYYY-MM-DD)";
			}
			return null;
		}
		case "boolean": {
			if (value !== "true" && value !== "false") {
				return "Must be true or false";
			}
			return null;
		}
		case "select": {
			if (!options) {
				return "Field has no options defined";
			}
			if (!options.includes(value)) {
				return `Must be one of: ${options.join(", ")}`;
			}
			return null;
		}
		case "text":
			return null;
		default:
			return null;
	}
}

export interface FieldValuesVM {
	values: CustomFieldValue[];
	isLoading: boolean;
	error: Error | null;

	setValue: (fieldDefId: string, value: string) => void;
	getValueFor: (fieldDefId: string) => string;
	validate: (fieldDef: CustomFieldDefinition, value: string) => string | null;

	isSaving: boolean;
}

export function useFieldValues(personId: string): FieldValuesVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data, isLoading, error } = useQuery(fieldModel.valuesQueryOptions(wid, personId));

	const setValueMutation = useMutation({
		...fieldModel.setValueMutationOptions(wid),
		onMutate: async ({ personId: pid, fieldDefId, input }) => {
			await queryClient.cancelQueries({ queryKey: fieldKeys.values(wid, pid) });
			const previous = queryClient.getQueryData<CustomFieldValue[]>(fieldKeys.values(wid, pid));
			queryClient.setQueryData(
				fieldKeys.values(wid, pid),
				(old: CustomFieldValue[] | undefined) => {
					const existing = (old ?? []).find((v) => v.fieldDefId === fieldDefId);
					if (existing) {
						return (old ?? []).map((v) =>
							v.fieldDefId === fieldDefId ? { ...v, value: input.value } : v,
						);
					}
					return [
						...(old ?? []),
						{
							id: `temp-${fieldDefId}`,
							workspaceId: wid,
							personId: pid,
							fieldDefId,
							value: input.value,
						},
					];
				},
			);
			return { previous };
		},
		onError: (err: Error, vars, context) => {
			queryClient.setQueryData(fieldKeys.values(wid, vars.personId), context?.previous);
			toast.error(err.message);
		},
		onSettled: (_data, _err, vars) => {
			queryClient.invalidateQueries({ queryKey: fieldKeys.values(wid, vars.personId) });
		},
	});

	const setValue = useCallback(
		(fieldDefId: string, value: string) =>
			setValueMutation.mutate(
				{ personId, fieldDefId, input: { value } },
				{ onSuccess: () => toast.success("Field saved") },
			),
		[setValueMutation, personId],
	);

	const getValueFor = useCallback(
		(fieldDefId: string) => (data ?? []).find((v) => v.fieldDefId === fieldDefId)?.value ?? "",
		[data],
	);

	const validate = useCallback(
		(fieldDef: CustomFieldDefinition, value: string) =>
			validateFieldValue(value, fieldDef.fieldType, fieldDef.options),
		[],
	);

	return {
		values: data ?? [],
		isLoading,
		error: error as Error | null,
		setValue,
		getValueFor,
		validate,
		isSaving: setValueMutation.isPending,
	};
}
