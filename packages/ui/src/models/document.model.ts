import type { CreateDocumentInput, UpdateDocumentInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const documentKeys = {
	all: (wid: string) => ["documents", wid] as const,
	detail: (wid: string, id: string) => ["documents", wid, id] as const,
	versions: (wid: string, id: string) => ["documents", wid, id, "versions"] as const,
};

export const documentModel = {
	listQueryOptions: (wid: string) =>
		queryOptions({
			queryKey: documentKeys.all(wid),
			queryFn: () => api.documents.list(wid),
			enabled: !!wid,
		}),

	detailQueryOptions: (wid: string, id: string) =>
		queryOptions({
			queryKey: documentKeys.detail(wid, id),
			queryFn: () => api.documents.get(wid, id),
			enabled: !!wid && !!id,
		}),

	versionsQueryOptions: (wid: string, id: string) =>
		queryOptions({
			queryKey: documentKeys.versions(wid, id),
			queryFn: () => api.documents.listVersions(wid, id),
			enabled: !!wid && !!id,
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
