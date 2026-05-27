import type { CreateTagInput, TagScope, TagWithCount, UpdateTagInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { tagKeys, tagModel } from "../../models/tag.model.js";

export interface TagsVM {
	tags: TagWithCount[];
	isLoading: boolean;
	error: Error | null;

	create: (input: CreateTagInput) => void;
	update: (id: string, input: UpdateTagInput) => void;
	remove: (id: string) => void;

	isCreating: boolean;
	isUpdating: boolean;
	isRemoving: boolean;
}

export function useTags(scope: TagScope): TagsVM {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data, isLoading, error } = useQuery(tagModel.queryOptions(wid, scope, true));

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: tagKeys.byScope(wid, scope) });
		queryClient.invalidateQueries({ queryKey: tagKeys.withCounts(wid, scope) });
	}, [queryClient, wid, scope]);

	const createMutation = useMutation({
		...tagModel.createMutationOptions(wid),
		onSuccess: () => {
			invalidate();
			toast.success("Tag created");
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const updateMutation = useMutation({
		...tagModel.updateMutationOptions(wid),
		onMutate: async ({ id, input }) => {
			const qk = tagKeys.withCounts(wid, scope);
			await queryClient.cancelQueries({ queryKey: qk });
			const previous = queryClient.getQueryData<TagWithCount[]>(qk);
			queryClient.setQueryData(qk, (old: TagWithCount[] | undefined) =>
				(old ?? []).map((t) => (t.id === id ? { ...t, ...input } : t)),
			);
			return { previous };
		},
		onSuccess: (updated) => {
			const qk = tagKeys.withCounts(wid, scope);
			queryClient.setQueryData(qk, (old: TagWithCount[] | undefined) =>
				(old ?? []).map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
			);
		},
		onError: (err: Error, _vars, context) => {
			queryClient.setQueryData(tagKeys.withCounts(wid, scope), context?.previous);
			toast.error(err.message);
		},
		onSettled: () => invalidate(),
	});

	const deleteMutation = useMutation({
		...tagModel.deleteMutationOptions(wid),
		onMutate: async (id) => {
			const qk = tagKeys.withCounts(wid, scope);
			await queryClient.cancelQueries({ queryKey: qk });
			const previous = queryClient.getQueryData<TagWithCount[]>(qk);
			queryClient.setQueryData(qk, (old: TagWithCount[] | undefined) =>
				(old ?? []).filter((t) => t.id !== id),
			);
			return { previous };
		},
		onSuccess: () => toast.success("Tag deleted"),
		onError: (err: Error, _id, context) => {
			queryClient.setQueryData(tagKeys.withCounts(wid, scope), context?.previous);
			toast.error(err.message);
		},
		onSettled: () => invalidate(),
	});

	const create = useCallback(
		(input: CreateTagInput) => createMutation.mutate(input),
		[createMutation],
	);
	const update = useCallback(
		(id: string, input: UpdateTagInput) => updateMutation.mutate({ id, input }),
		[updateMutation],
	);
	const remove = useCallback((id: string) => deleteMutation.mutate(id), [deleteMutation]);

	return {
		tags: data ?? [],
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
