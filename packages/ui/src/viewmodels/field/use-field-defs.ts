import type { CreateFieldDefInput, CustomFieldDefinition, UpdateFieldDefInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { fieldKeys, fieldModel } from "../../models/field.model.js";

export interface FieldDefsVM {
	defs: CustomFieldDefinition[];
	isLoading: boolean;
	error: Error | null;

	create: (input: CreateFieldDefInput) => void;
	update: (id: string, input: UpdateFieldDefInput) => void;
	remove: (id: string) => void;
	reorder: (id: string, newSortOrder: number) => void;

	isCreating: boolean;
	isUpdating: boolean;
	isRemoving: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function useFieldDefs(): FieldDefsVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);

	const { data, isLoading, error } = useQuery(fieldModel.defsQueryOptions(wid));

	const createMutation = useMutation({
		...fieldModel.createDefMutationOptions(wid),
		onSuccess: (created) => {
			queryClient.setQueryData(fieldKeys.defs(wid), (old: CustomFieldDefinition[] | undefined) => [
				...(old ?? []),
				created,
			]);
			setMutationError(null);
		},
		onError: (err: Error) => setMutationError(err),
	});

	const updateMutation = useMutation({
		...fieldModel.updateDefMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: fieldKeys.defs(wid) });
			const previous = queryClient.getQueryData<CustomFieldDefinition[]>(fieldKeys.defs(wid));
			queryClient.setQueryData(fieldKeys.defs(wid), (old: CustomFieldDefinition[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, ...input } : d)),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(fieldKeys.defs(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: fieldKeys.defs(wid) });
		},
	});

	const deleteMutation = useMutation({
		...fieldModel.deleteDefMutationOptions(wid),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: fieldKeys.defs(wid) });
			const previous = queryClient.getQueryData<CustomFieldDefinition[]>(fieldKeys.defs(wid));
			queryClient.setQueryData(fieldKeys.defs(wid), (old: CustomFieldDefinition[] | undefined) =>
				(old ?? []).filter((d) => d.id !== id),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(fieldKeys.defs(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: fieldKeys.defs(wid) });
		},
	});

	const create = useCallback(
		(input: CreateFieldDefInput) => createMutation.mutate(input),
		[createMutation],
	);
	const update = useCallback(
		(id: string, input: UpdateFieldDefInput) => updateMutation.mutate({ id, input }),
		[updateMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);
	const reorder = useCallback(
		(id: string, newSortOrder: number) =>
			updateMutation.mutate({ id, input: { sortOrder: newSortOrder } }),
		[updateMutation],
	);
	const clearMutationError = useCallback(() => setMutationError(null), []);

	return {
		defs: data ?? [],
		isLoading,
		error: error as Error | null,
		create,
		update,
		remove,
		reorder,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isRemoving: deleteMutation.isPending,
		mutationError,
		clearMutationError,
	};
}
