import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const workspaceKeys = {
	all: ["workspaces"] as const,
	detail: (id: string) => ["workspaces", id] as const,
};

export const workspaceModel = {
	listQueryOptions: () =>
		queryOptions({
			queryKey: workspaceKeys.all,
			queryFn: () => api.workspaces.list(),
		}),

	detailQueryOptions: (id: string) =>
		queryOptions({
			queryKey: workspaceKeys.detail(id),
			queryFn: () => api.workspaces.get(id),
		}),

	createMutationOptions: () => ({
		mutationFn: (input: CreateWorkspaceInput) => api.workspaces.create(input),
	}),

	updateMutationOptions: () => ({
		mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) =>
			api.workspaces.update(id, input),
	}),

	deleteMutationOptions: () => ({
		mutationFn: (id: string) => api.workspaces.delete(id),
	}),
};
