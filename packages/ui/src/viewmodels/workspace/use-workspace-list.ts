import type { Workspace } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { workspaceKeys, workspaceModel } from "../../models/workspace.model.js";

export interface WorkspaceListVM {
	workspaces: Workspace[];
	isLoading: boolean;
	error: Error | null;

	selectedId: string | null;
	select: (id: string | null) => void;

	create: (name: string) => void;
	rename: (id: string, name: string) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isRenaming: boolean;
	isRemoving: boolean;
}

export function useWorkspaceList(): WorkspaceListVM {
	const queryClient = useQueryClient();
	const { workspaceId, switchWorkspace } = useWorkspaceContext();

	const { data, isLoading, error } = useQuery(workspaceModel.listQueryOptions());

	const select = useCallback(
		(id: string | null) => {
			if (id === null) {
				switchWorkspace(null);
				return;
			}
			const ws = data?.find((w) => w.id === id) ?? null;
			switchWorkspace(ws);
		},
		[data, switchWorkspace],
	);

	const createMutation = useMutation({
		...workspaceModel.createMutationOptions(),
		onSuccess: (created) => {
			queryClient.setQueryData(workspaceKeys.all, (old: Workspace[] | undefined) => [
				...(old ?? []),
				created,
			]);
			toast.success("Workspace created");
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		...workspaceModel.updateMutationOptions(),
		onMutate: async ({ id, input }) => {
			await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
			const previous = queryClient.getQueryData<Workspace[]>(workspaceKeys.all);
			const previousWorkspace =
				workspaceId === id ? (previous?.find((w) => w.id === id) ?? null) : null;
			queryClient.setQueryData(workspaceKeys.all, (old: Workspace[] | undefined) =>
				(old ?? []).map((w) => (w.id === id ? { ...w, name: input.name } : w)),
			);
			if (workspaceId === id && previousWorkspace) {
				switchWorkspace({ ...previousWorkspace, name: input.name });
			}
			return { previous, previousWorkspace };
		},
		onSuccess: (updated, { id }) => {
			if (workspaceId === id) {
				switchWorkspace(updated);
			}
			toast.success("Workspace renamed");
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(workspaceKeys.all, context?.previous);
			if (context?.previousWorkspace) {
				switchWorkspace(context.previousWorkspace);
			}
			toast.error(err.message);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
		},
	});

	const deleteMutation = useMutation({
		...workspaceModel.deleteMutationOptions(),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
			const previous = queryClient.getQueryData<Workspace[]>(workspaceKeys.all);
			const previousSelectedId = workspaceId;
			queryClient.setQueryData(workspaceKeys.all, (old: Workspace[] | undefined) =>
				(old ?? []).filter((w) => w.id !== id),
			);
			if (workspaceId === id) {
				switchWorkspace(null);
			}
			return { previous, previousSelectedId };
		},
		onSuccess: () => {
			toast.success("Workspace deleted");
		},
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(workspaceKeys.all, context?.previous);
			if (context?.previousSelectedId && context.previous) {
				const ws = context.previous.find((w) => w.id === context.previousSelectedId) ?? null;
				switchWorkspace(ws);
			}
			toast.error(err.message);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
		},
	});

	const create = useCallback((name: string) => createMutation.mutate({ name }), [createMutation]);
	const rename = useCallback(
		(id: string, name: string) => updateMutation.mutate({ id, input: { name } }),
		[updateMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);

	return {
		workspaces: data ?? [],
		isLoading,
		error: error as Error | null,
		selectedId: workspaceId,
		select,
		create,
		rename,
		remove,
		isCreating: createMutation.isPending,
		isRenaming: updateMutation.isPending,
		isRemoving: deleteMutation.isPending,
	};
}
