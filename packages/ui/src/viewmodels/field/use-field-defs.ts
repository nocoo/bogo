import type { CreateFieldDefInput, CustomFieldDefinition, UpdateFieldDefInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
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
}

export function useFieldDefs(): FieldDefsVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data, isLoading, error } = useQuery(fieldModel.defsQueryOptions(wid));

	const createMutation = useMutation({
		...fieldModel.createDefMutationOptions(wid),
		onSuccess: (created) => {
			queryClient.setQueryData(fieldKeys.defs(wid), (old: CustomFieldDefinition[] | undefined) => [
				...(old ?? []),
				created,
			]);
			toast.success("Field created");
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		...fieldModel.updateDefMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: fieldKeys.defs(wid) });
			const previous = queryClient.getQueryData<CustomFieldDefinition[]>(fieldKeys.defs(wid));
			queryClient.setQueryData(fieldKeys.defs(wid), (old: CustomFieldDefinition[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, ...input } : d)),
			);
			return { previous };
		},
		onSuccess: (_data, vars) => {
			if (!vars.silent) {
				toast.success("Field saved");
			}
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(fieldKeys.defs(wid), context?.previous);
			toast.error(err.message);
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
			return { previous };
		},
		onSuccess: () => {
			toast.success("Field deleted");
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(fieldKeys.defs(wid), context?.previous);
			toast.error(err.message);
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
			updateMutation.mutate({ id, input: { sortOrder: newSortOrder }, silent: true }),
		[updateMutation],
	);

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
	};
}
