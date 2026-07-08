import type { CreateDocTypeInput, UpdateDocTypeInput } from "@bogo/shared";
import { queryOptions } from "@tanstack/react-query";
import { api } from "../lib/api/index.js";

export const docTypeKeys = {
	all: (wid: string) => ["docTypes", wid] as const,
};

export const docTypeModel = {
	queryOptions: (wid: string) =>
		queryOptions({
			queryKey: docTypeKeys.all(wid),
			queryFn: () => api.docTypes.list(wid),
			enabled: !!wid,
		}),

	createMutationOptions: (wid: string) => ({
		mutationFn: (input: CreateDocTypeInput) => api.docTypes.create(wid, input),
	}),

	updateMutationOptions: (wid: string) => ({
		mutationFn: ({ id, input }: { id: string; input: UpdateDocTypeInput; silent?: boolean }) =>
			api.docTypes.update(wid, id, input),
	}),

	deleteMutationOptions: (wid: string) => ({
		mutationFn: (id: string) => api.docTypes.delete(wid, id),
	}),
};
