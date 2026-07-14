import type { CreateFieldDefInput, SetFieldValueInput, UpdateFieldDefInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const fieldKeys = {
	defs: (wid: string) => ["fieldDefs", wid] as const,
	values: (wid: string, personId: string) => ["fieldValues", wid, personId] as const,
	allValues: (wid: string) => ["fieldValues", wid, "__all"] as const,
};

export const fieldModel = {
	defsQueryOptions: (wid: string) =>
		queryOptions({
			queryKey: fieldKeys.defs(wid),
			queryFn: () => api.fields.listDefs(wid),
			enabled: !!wid,
		}),

	valuesQueryOptions: (wid: string, personId: string) =>
		queryOptions({
			queryKey: fieldKeys.values(wid, personId),
			queryFn: () => api.fields.getValues(wid, personId),
			enabled: !!wid && !!personId,
		}),

	allValuesQueryOptions: (wid: string, enabled = true) =>
		queryOptions({
			queryKey: fieldKeys.allValues(wid),
			queryFn: () => api.fields.listAllValues(wid),
			enabled: !!wid && enabled,
		}),

	createDefMutationOptions: (wid: string) => ({
		mutationFn: (input: CreateFieldDefInput) => api.fields.createDef(wid, input),
	}),

	updateDefMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdateFieldDefInput; silent?: boolean }) =>
			api.fields.updateDef(wid, id, input),
	}),

	deleteDefMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.fields.deleteDef(wid, id),
	}),

	setValueMutationOptions: (wid: string) => ({
		mutationFn: ({
			personId,
			fieldDefId,
			input,
		}: {
			personId: string;
			fieldDefId: string;
			input: SetFieldValueInput;
		}) => api.fields.setValue(wid, personId, fieldDefId, input),
	}),
};
