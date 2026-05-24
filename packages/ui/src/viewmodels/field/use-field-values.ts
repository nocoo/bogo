import type { CustomFieldDefinition, CustomFieldValue, FieldType } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { fieldKeys, fieldModel } from "../../models/field.model.js";

export function validateFieldValue(
	value: string,
	fieldType: FieldType,
	options: string[] | null,
): string | null {
	if (!value) {
		return null;
	}
	switch (fieldType) {
		case "number": {
			const n = Number(value);
			if (!Number.isFinite(n)) {
				return "Must be a valid number";
			}
			return null;
		}
		case "date": {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				return "Must be YYYY-MM-DD format";
			}
			const d = new Date(value);
			if (Number.isNaN(d.getTime())) {
				return "Must be a valid date";
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
			if (options && !options.includes(value)) {
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
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function useFieldValues(personId: string): FieldValuesVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);

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
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, vars, context) => {
			queryClient.setQueryData(fieldKeys.values(wid, vars.personId), context?.previous);
			setMutationError(err);
		},
		onSettled: (_data, _err, vars) => {
			queryClient.invalidateQueries({ queryKey: fieldKeys.values(wid, vars.personId) });
		},
	});

	const setValue = useCallback(
		(fieldDefId: string, value: string) =>
			setValueMutation.mutate({ personId, fieldDefId, input: { value } }),
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

	const clearMutationError = useCallback(() => setMutationError(null), []);

	return {
		values: data ?? [],
		isLoading,
		error: error as Error | null,
		setValue,
		getValueFor,
		validate,
		isSaving: setValueMutation.isPending,
		mutationError,
		clearMutationError,
	};
}
