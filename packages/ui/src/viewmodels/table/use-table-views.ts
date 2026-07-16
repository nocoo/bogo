import type { CreatePersonTableViewInput, UpdatePersonTableViewInput } from "@bogo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { tableViewKeys, tableViewModel } from "@/models/table-view.model";

export function useTableViews(selectedViewId: string | null) {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";
	const qc = useQueryClient();

	const listQuery = useQuery(tableViewModel.listQueryOptions(wid));

	const views = listQuery.data ?? [];
	const defaultView = useMemo(() => views.find((v) => v.isDefault) ?? views[0] ?? null, [views]);

	const activeView = useMemo(() => {
		if (selectedViewId) {
			return views.find((v) => v.id === selectedViewId) ?? null;
		}
		return defaultView;
	}, [views, selectedViewId, defaultView]);

	const invalidate = () => qc.invalidateQueries({ queryKey: tableViewKeys.all(wid) });

	const createMut = useMutation({
		...tableViewModel.createMutationOptions(wid),
		onSuccess: invalidate,
	});
	const updateMut = useMutation({
		...tableViewModel.updateMutationOptions(wid),
		onSuccess: invalidate,
	});
	const deleteMut = useMutation({
		...tableViewModel.deleteMutationOptions(wid),
		onSuccess: invalidate,
	});

	return {
		wid,
		views,
		defaultView,
		activeView,
		isLoading: listQuery.isLoading,
		isError: listQuery.isError,
		createView: (input: CreatePersonTableViewInput) => createMut.mutateAsync(input),
		updateView: (id: string, input: UpdatePersonTableViewInput) =>
			updateMut.mutateAsync({ id, input }),
		deleteView: (id: string) => deleteMut.mutateAsync(id),
		isSaving: createMut.isPending || updateMut.isPending || deleteMut.isPending,
	};
}
