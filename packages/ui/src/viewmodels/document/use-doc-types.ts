import type { CreateDocTypeInput, DocumentType, UpdateDocTypeInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { docTypeKeys, docTypeModel } from "../../models/doc-type.model.js";

export interface DocTypesVM {
	types: DocumentType[];
	isLoading: boolean;
	error: Error | null;

	create: (input: CreateDocTypeInput) => void;
	update: (id: string, input: UpdateDocTypeInput) => void;
	remove: (id: string) => void;
	reorder: (id: string, newSortOrder: number) => void;

	isCreating: boolean;
	isUpdating: boolean;
	isRemoving: boolean;
}

export function useDocTypes(): DocTypesVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data, isLoading, error } = useQuery(docTypeModel.queryOptions(wid));

	const createMutation = useMutation({
		...docTypeModel.createMutationOptions(wid),
		onSuccess: (created) => {
			queryClient.setQueryData(docTypeKeys.all(wid), (old: DocumentType[] | undefined) => [
				...(old ?? []),
				created,
			]);
			toast.success("Document type created");
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		...docTypeModel.updateMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: docTypeKeys.all(wid) });
			const previous = queryClient.getQueryData<DocumentType[]>(docTypeKeys.all(wid));
			queryClient.setQueryData(docTypeKeys.all(wid), (old: DocumentType[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, ...input } : d)),
			);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(docTypeKeys.all(wid), context?.previous);
			toast.error(err.message);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: docTypeKeys.all(wid) });
		},
	});

	const deleteMutation = useMutation({
		...docTypeModel.deleteMutationOptions(wid),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: docTypeKeys.all(wid) });
			const previous = queryClient.getQueryData<DocumentType[]>(docTypeKeys.all(wid));
			queryClient.setQueryData(docTypeKeys.all(wid), (old: DocumentType[] | undefined) =>
				(old ?? []).filter((d) => d.id !== id),
			);
			return { previous };
		},
		onSuccess: () => {
			toast.success("Document type deleted");
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(docTypeKeys.all(wid), context?.previous);
			toast.error(err.message);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: docTypeKeys.all(wid) });
		},
	});

	const create = useCallback(
		(input: CreateDocTypeInput) => createMutation.mutate(input),
		[createMutation],
	);
	const update = useCallback(
		(id: string, input: UpdateDocTypeInput) =>
			updateMutation.mutate(
				{ id, input },
				{ onSuccess: () => toast.success("Document type saved") },
			),
		[updateMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);
	const reorder = useCallback(
		(id: string, newSortOrder: number) =>
			updateMutation.mutate({ id, input: { sortOrder: newSortOrder } }),
		[updateMutation],
	);

	return {
		types: data ?? [],
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
