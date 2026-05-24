import type { Person } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { personKeys, personModel } from "../../models/person.model.js";

export interface PersonListVM {
	persons: Person[];
	isLoading: boolean;
	error: Error | null;

	create: (name: string, managerId: string | null) => void;
	update: (id: string, fields: { name?: string; title?: string }) => void;
	move: (id: string, newManagerId: string | null) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isMoving: boolean;
	isRemoving: boolean;
	mutationError: Error | null;
	clearMutationError: () => void;
}

export function usePersonList(): PersonListVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const [mutationError, setMutationError] = useState<Error | null>(null);

	const { data, isLoading, error } = useQuery(personModel.listQueryOptions(wid));

	const createMutation = useMutation({
		...personModel.createMutationOptions(wid),
		onSuccess: (created) => {
			queryClient.setQueryData(personKeys.all(wid), (old: Person[] | undefined) => [
				...(old ?? []),
				created,
			]);
			setMutationError(null);
		},
		onError: (err: Error) => setMutationError(err),
	});

	const updateMutation = useMutation({
		...personModel.updateMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: personKeys.all(wid) });
			const previous = queryClient.getQueryData<Person[]>(personKeys.all(wid));
			queryClient.setQueryData(personKeys.all(wid), (old: Person[] | undefined) =>
				(old ?? []).map((p) => (p.id === id ? { ...p, ...input } : p)),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(personKeys.all(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: personKeys.all(wid) });
		},
	});

	const moveMutation = useMutation({
		...personModel.moveMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: personKeys.all(wid) });
			const previous = queryClient.getQueryData<Person[]>(personKeys.all(wid));
			queryClient.setQueryData(personKeys.all(wid), (old: Person[] | undefined) =>
				(old ?? []).map((p) => (p.id === id ? { ...p, managerId: input.managerId } : p)),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(personKeys.all(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: personKeys.all(wid) });
		},
	});

	const deleteMutation = useMutation({
		...personModel.deleteMutationOptions(wid),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: personKeys.all(wid) });
			const previous = queryClient.getQueryData<Person[]>(personKeys.all(wid));
			queryClient.setQueryData(personKeys.all(wid), (old: Person[] | undefined) =>
				(old ?? []).filter((p) => p.id !== id),
			);
			setMutationError(null);
			return { previous };
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(personKeys.all(wid), context?.previous);
			setMutationError(err);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: personKeys.all(wid) });
		},
	});

	const create = useCallback(
		(name: string, managerId: string | null) =>
			createMutation.mutate({ name, title: "", managerId }),
		[createMutation],
	);
	const update = useCallback(
		(id: string, fields: { name?: string; title?: string }) =>
			updateMutation.mutate({ id, input: fields }),
		[updateMutation],
	);
	const move = useCallback(
		(id: string, newManagerId: string | null) =>
			moveMutation.mutate({ id, input: { managerId: newManagerId } }),
		[moveMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);
	const clearMutationError = useCallback(() => setMutationError(null), []);

	return {
		persons: data ?? [],
		isLoading,
		error: error as Error | null,
		create,
		update,
		move,
		remove,
		isCreating: createMutation.isPending,
		isMoving: moveMutation.isPending,
		isRemoving: deleteMutation.isPending,
		mutationError,
		clearMutationError,
	};
}
