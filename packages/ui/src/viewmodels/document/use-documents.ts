import type { CreateDocumentInput, Document, UpdateDocumentInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { documentKeys, documentModel } from "../../models/document.model.js";

export interface DocumentsVM {
	documents: Document[];
	isLoading: boolean;
	error: Error | null;

	create: (input: CreateDocumentInput) => void;
	update: (id: string, input: UpdateDocumentInput) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isUpdating: boolean;
	isRemoving: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function useDocuments(): DocumentsVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);

	const { data, isLoading, error } = useQuery(documentModel.listQueryOptions(wid));

	const createMutation = useMutation({
		...documentModel.createMutationOptions(wid),
		onSuccess: (created) => {
			queryClient.setQueryData(documentKeys.all(wid), (old: Document[] | undefined) => [
				...(old ?? []),
				created,
			]);
			setMutationError(null);
		},
		onError: (err: Error) => setMutationError(err),
	});

	const updateMutation = useMutation({
		...documentModel.updateMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.all(wid) });
			const previous = queryClient.getQueryData<Document[]>(documentKeys.all(wid));
			queryClient.setQueryData(documentKeys.all(wid), (old: Document[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, ...input } : d)),
			);
			setMutationError(null);
			return { previous };
		},
		onSuccess: (result, { id }) => {
			queryClient.setQueryData(documentKeys.all(wid), (old: Document[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, version: result.version } : d)),
			);
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(documentKeys.all(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.all(wid) });
		},
	});

	const deleteMutation = useMutation({
		...documentModel.deleteMutationOptions(wid),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.all(wid) });
			const previous = queryClient.getQueryData<Document[]>(documentKeys.all(wid));
			queryClient.setQueryData(documentKeys.all(wid), (old: Document[] | undefined) =>
				(old ?? []).filter((d) => d.id !== id),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(documentKeys.all(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.all(wid) });
		},
	});

	const create = useCallback(
		(input: CreateDocumentInput) => createMutation.mutate(input),
		[createMutation],
	);
	const update = useCallback(
		(id: string, input: UpdateDocumentInput) => updateMutation.mutate({ id, input }),
		[updateMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);
	const clearMutationError = useCallback(() => setMutationError(null), []);

	return {
		documents: data ?? [],
		isLoading,
		error: error as Error | null,
		create,
		update,
		remove,
		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isRemoving: deleteMutation.isPending,
		mutationError,
		clearMutationError,
	};
}
