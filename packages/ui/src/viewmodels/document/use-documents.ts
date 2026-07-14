import type { CreateDocumentInput, DocumentSummary, UpdateDocumentInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { documentKeys, documentModel } from "../../models/document.model.js";

export interface DocumentsVM {
	documents: DocumentSummary[];
	isLoading: boolean;
	error: Error | null;

	create: (input: CreateDocumentInput) => void;
	update: (id: string, input: UpdateDocumentInput) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isUpdating: boolean;
	isRemoving: boolean;
}

export function useDocuments(tagIds?: string[]): DocumentsVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data, isLoading, error } = useQuery(documentModel.listQueryOptions(wid, tagIds));

	const createMutation = useMutation({
		...documentModel.createMutationOptions(wid),
		onSuccess: (created) => {
			// Prepend — the list is server-sorted by updated_at DESC, and a
			// just-created doc always has the newest updated_at. Append would
			// bury it at the bottom of the list.
			queryClient.setQueryData(documentKeys.all(wid), (old: DocumentSummary[] | undefined) => [
				created,
				...(old ?? []),
			]);
			toast.success("Document created");
		},
		onError: (err: Error) => toast.error(err.message),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.all(wid) });
		},
	});

	const updateMutation = useMutation({
		...documentModel.updateMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.all(wid) });
			const previous = queryClient.getQueryData<DocumentSummary[]>(documentKeys.all(wid));
			queryClient.setQueryData(documentKeys.all(wid), (old: DocumentSummary[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, ...input } : d)),
			);
			return { previous };
		},
		onSuccess: (result, { id }) => {
			queryClient.setQueryData(documentKeys.all(wid), (old: DocumentSummary[] | undefined) =>
				(old ?? []).map((d) => (d.id === id ? { ...d, version: result.version } : d)),
			);
			toast.success("Document saved");
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(documentKeys.all(wid), context?.previous);
			toast.error(err.message);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.all(wid) });
		},
	});

	const deleteMutation = useMutation({
		...documentModel.deleteMutationOptions(wid),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.all(wid) });
			const previous = queryClient.getQueryData<DocumentSummary[]>(documentKeys.all(wid));
			queryClient.setQueryData(documentKeys.all(wid), (old: DocumentSummary[] | undefined) =>
				(old ?? []).filter((d) => d.id !== id),
			);
			return { previous };
		},
		onSuccess: () => {
			toast.success("Document deleted");
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(documentKeys.all(wid), context?.previous);
			toast.error(err.message);
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
	};
}
