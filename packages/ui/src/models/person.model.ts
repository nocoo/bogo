import type { CreatePersonInput, MovePersonInput, UpdatePersonInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const personKeys = {
	all: (wid: string) => ["persons", wid] as const,
	detail: (wid: string, id: string) => ["persons", wid, id] as const,
	documents: (wid: string, id: string) => ["persons", wid, id, "documents"] as const,
};

export const personModel = {
	listQueryOptions: (wid: string) =>
		queryOptions({
			queryKey: personKeys.all(wid),
			queryFn: () => api.persons.list(wid),
			enabled: !!wid,
		}),

	detailQueryOptions: (wid: string, id: string) =>
		queryOptions({
			queryKey: personKeys.detail(wid, id),
			queryFn: () => api.persons.get(wid, id),
			enabled: !!wid && !!id,
		}),

	documentsQueryOptions: (wid: string, id: string) =>
		queryOptions({
			queryKey: personKeys.documents(wid, id),
			queryFn: () => api.persons.listDocuments(wid, id),
			enabled: !!wid && !!id,
		}),

	createMutationOptions: (wid: string) => ({
		mutationFn: (input: CreatePersonInput) => api.persons.create(wid, input),
	}),

	updateMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdatePersonInput }) =>
			api.persons.update(wid, id, input),
	}),

	moveMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: MovePersonInput }) =>
			api.persons.move(wid, id, input),
	}),

	deleteMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.persons.delete(wid, id),
	}),
};
