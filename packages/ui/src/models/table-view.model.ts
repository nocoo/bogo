import type { CreatePersonTableViewInput, UpdatePersonTableViewInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const tableViewKeys = {
	all: (wid: string) => ["table-views", wid] as const,
	detail: (wid: string, id: string) => ["table-views", wid, id] as const,
};

export const tableViewModel = {
	listQueryOptions: (wid: string) =>
		queryOptions({
			queryKey: tableViewKeys.all(wid),
			queryFn: () => api.tableViews.list(wid),
			enabled: !!wid,
		}),

	createMutationOptions: (wid: string) => ({
		mutationFn: (input: CreatePersonTableViewInput) => api.tableViews.create(wid, input),
	}),

	updateMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdatePersonTableViewInput }) =>
			api.tableViews.update(wid, id, input),
	}),

	deleteMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.tableViews.delete(wid, id),
	}),
};
