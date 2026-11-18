import type { TagScope } from "@bogo/shared";
import { toast } from "@nocoo/basalt/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { tagKeys, tagModel } from "../../models/tag.model.js";

export function useTagAssignment(scope: TagScope) {
	const queryClient = useQueryClient();
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const entityType = scope === "document" ? "documents" : "persons";

	const invalidateAll = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: tagKeys.withCounts(wid, scope) });
		queryClient.invalidateQueries({ queryKey: tagKeys.stats(wid, scope) });
		const entityKey = scope === "document" ? "documents" : "persons";
		queryClient.invalidateQueries({ queryKey: [entityKey] });
	}, [queryClient, wid, scope]);

	const assignMutation = useMutation({
		...tagModel.assignMutationOptions(wid),
		onSuccess: () => invalidateAll(),
		onError: (err: Error) => toast.error(err.message),
	});

	const unassignMutation = useMutation({
		...tagModel.unassignMutationOptions(wid),
		onSuccess: () => invalidateAll(),
		onError: (err: Error) => toast.error(err.message),
	});

	const assign = useCallback(
		(tagId: string, entityId: string) => assignMutation.mutate({ tagId, entityType, entityId }),
		[assignMutation, entityType],
	);

	const unassign = useCallback(
		(tagId: string, entityId: string) => unassignMutation.mutate({ tagId, entityType, entityId }),
		[unassignMutation, entityType],
	);

	return {
		assign,
		unassign,
		isAssigning: assignMutation.isPending,
		isUnassigning: unassignMutation.isPending,
	};
}
