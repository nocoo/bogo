import type { CreateTagInput, TagScope, UpdateTagInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const tagKeys = {
	all: (wid: string) => ["tags", wid] as const,
	byScope: (wid: string, scope: TagScope) => ["tags", wid, scope] as const,
	withCounts: (wid: string, scope: TagScope) => ["tags", wid, scope, "counts"] as const,
	stats: (wid: string, scope: TagScope) => ["tags", wid, scope, "stats"] as const,
};

export const tagModel = {
	queryOptions: (wid: string, scope: TagScope, includeCounts = false) =>
		queryOptions({
			queryKey: includeCounts ? tagKeys.withCounts(wid, scope) : tagKeys.byScope(wid, scope),
			queryFn: () => api.tags.list(wid, scope, includeCounts),
			enabled: !!wid,
		}),

	statsQueryOptions: (wid: string, scope: TagScope) =>
		queryOptions({
			queryKey: tagKeys.stats(wid, scope),
			queryFn: () => api.tags.stats(wid, scope),
			enabled: !!wid,
		}),

	createMutationOptions: (wid: string) => ({
		mutationFn: (input: CreateTagInput) => api.tags.create(wid, input),
	}),

	updateMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdateTagInput }) =>
			api.tags.update(wid, id, input),
	}),

	deleteMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.tags.delete(wid, id),
	}),

	assignMutationOptions: (wid: string) => ({
		mutationFn: ({
			tagId,
			entityType,
			entityId,
		}: { tagId: string; entityType: "documents" | "persons"; entityId: string }) =>
			api.tags.assign(wid, tagId, entityType, entityId),
	}),

	unassignMutationOptions: (wid: string) => ({
		mutationFn: ({
			tagId,
			entityType,
			entityId,
		}: { tagId: string; entityType: "documents" | "persons"; entityId: string }) =>
			api.tags.unassign(wid, tagId, entityType, entityId),
	}),
};
