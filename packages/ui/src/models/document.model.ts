import type { CreateDocumentInput, UpdateDocumentInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const documentKeys = {
	all: (wid: string) => ["documents", wid] as const,
};

export const documentModel = {
	listQueryOptions: (wid: string) =>
		queryOptions({
			queryKey: documentKeys.all(wid),
			queryFn: () => api.documents.list(wid),
			enabled: !!wid,
		}),

	createMutationOptions: (wid: string) => ({
		mutationFn: (input: CreateDocumentInput) => api.documents.create(wid, input),
	}),

	updateMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdateDocumentInput }) =>
			api.documents.update(wid, id, input),
	}),

	deleteMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.documents.delete(wid, id),
	}),
};
