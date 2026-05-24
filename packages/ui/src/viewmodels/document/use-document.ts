import type { Document, DocumentVersion, UpdateDocumentInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { documentKeys, documentModel } from "../../models/document.model.js";

export interface DocumentVM {
	document: Document | null;
	versions: DocumentVersion[];
	isLoading: boolean;
	isLoadingVersions: boolean;
	error: Error | null;

	update: (input: UpdateDocumentInput, opts?: { onSuccess?: () => void }) => void;
	isUpdating: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function useDocument(id: string): DocumentVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);

	const { data: document, isLoading, error } = useQuery(documentModel.detailQueryOptions(wid, id));

	const { data: versions, isLoading: isLoadingVersions } = useQuery(
		documentModel.versionsQueryOptions(wid, id),
	);

	const updateMutation = useMutation({
		...documentModel.updateMutationOptions(wid),
		onMutate: async ({ input }) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.detail(wid, id) });
			const previous = queryClient.getQueryData<Document>(documentKeys.detail(wid, id));
			if (previous) {
				queryClient.setQueryData(documentKeys.detail(wid, id), { ...previous, ...input });
			}
			setMutationError(null);
			return { previous };
		},
		onSuccess: (result) => {
			queryClient.setQueryData(documentKeys.detail(wid, id), (old: Document | undefined) =>
				old ? { ...old, version: result.version } : old,
			);
			queryClient.invalidateQueries({ queryKey: documentKeys.all(wid) });
			queryClient.invalidateQueries({ queryKey: documentKeys.versions(wid, id) });
		},
		onError: (err: Error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(documentKeys.detail(wid, id), context.previous);
			}
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.detail(wid, id) });
		},
	});

	const update = useCallback(
		(input: UpdateDocumentInput, opts?: { onSuccess?: () => void }) =>
			updateMutation.mutate({ id, input }, { onSuccess: opts?.onSuccess }),
		[updateMutation, id],
	);
	const clearMutationError = useCallback(() => setMutationError(null), []);

	return {
		document: document ?? null,
		versions: versions ?? [],
		isLoading,
		isLoadingVersions,
		error: error as Error | null,
		update,
		isUpdating: updateMutation.isPending,
		mutationError,
		clearMutationError,
	};
}
