import type { Document, DocumentPerson, DocumentVersion, UpdateDocumentInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { documentKeys, documentModel } from "../../models/document.model.js";

export interface AddPersonInput {
	personId: string;
	role?: string;
}

export interface DocumentVM {
	document: Document | null;
	versions: DocumentVersion[];
	persons: DocumentPerson[];
	isLoading: boolean;
	isLoadingVersions: boolean;
	isLoadingPersons: boolean;
	error: Error | null;

	update: (input: UpdateDocumentInput, opts?: { onSuccess?: () => void }) => void;
	isUpdating: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;

	addPerson: (input: AddPersonInput, opts?: { onSuccess?: () => void }) => void;
	isAddingPerson: boolean;
	removePerson: (personId: string, opts?: { onSuccess?: () => void }) => void;
	isRemovingPerson: boolean;
	personError: Error | null;
	clearPersonError: () => void;
}

export function useDocument(id: string): DocumentVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);
	const [personError, setPersonError] = useState<Error | null>(null);

	const { data: document, isLoading, error } = useQuery(documentModel.detailQueryOptions(wid, id));

	const { data: versions, isLoading: isLoadingVersions } = useQuery(
		documentModel.versionsQueryOptions(wid, id),
	);

	const { data: persons, isLoading: isLoadingPersons } = useQuery(
		documentModel.personsQueryOptions(wid, id),
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

	const addPersonMutation = useMutation({
		...documentModel.addPersonMutationOptions(wid),
		onMutate: async ({ input }) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.persons(wid, id) });
			const previous = queryClient.getQueryData<DocumentPerson[]>(documentKeys.persons(wid, id));
			const optimistic: DocumentPerson = {
				workspaceId: wid,
				documentId: id,
				personId: input.personId,
				role: input.role ?? "subject",
			};
			queryClient.setQueryData(documentKeys.persons(wid, id), [...(previous ?? []), optimistic]);
			setPersonError(null);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(documentKeys.persons(wid, id), context.previous);
			}
			setPersonError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.persons(wid, id) });
		},
	});

	const removePersonMutation = useMutation({
		...documentModel.removePersonMutationOptions(wid),
		onMutate: async ({ personId }) => {
			await queryClient.cancelQueries({ queryKey: documentKeys.persons(wid, id) });
			const previous = queryClient.getQueryData<DocumentPerson[]>(documentKeys.persons(wid, id));
			queryClient.setQueryData(
				documentKeys.persons(wid, id),
				(previous ?? []).filter((p) => p.personId !== personId),
			);
			setPersonError(null);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(documentKeys.persons(wid, id), context.previous);
			}
			setPersonError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: documentKeys.persons(wid, id) });
		},
	});

	const update = useCallback(
		(input: UpdateDocumentInput, opts?: { onSuccess?: () => void }) =>
			updateMutation.mutate({ id, input }, { onSuccess: opts?.onSuccess }),
		[updateMutation, id],
	);

	const addPerson = useCallback(
		(input: AddPersonInput, opts?: { onSuccess?: () => void }) =>
			addPersonMutation.mutate(
				{ docId: id, input: { personId: input.personId, role: input.role ?? "subject" } },
				{ onSuccess: opts?.onSuccess },
			),
		[addPersonMutation, id],
	);

	const removePerson = useCallback(
		(personId: string, opts?: { onSuccess?: () => void }) =>
			removePersonMutation.mutate({ docId: id, personId }, { onSuccess: opts?.onSuccess }),
		[removePersonMutation, id],
	);

	const clearMutationError = useCallback(() => setMutationError(null), []);
	const clearPersonError = useCallback(() => setPersonError(null), []);

	return {
		document: document ?? null,
		versions: versions ?? [],
		persons: persons ?? [],
		isLoading,
		isLoadingVersions,
		isLoadingPersons: isLoadingPersons,
		error: error as Error | null,
		update,
		isUpdating: updateMutation.isPending,
		mutationError,
		clearMutationError,
		addPerson,
		isAddingPerson: addPersonMutation.isPending,
		removePerson,
		isRemovingPerson: removePersonMutation.isPending,
		personError,
		clearPersonError,
	};
}
