import type { CreateDocTypeInput, DocumentType, UpdateDocTypeInput } from "@bogo/shared";
import type { Client } from "./client.js";

export function docTypeApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/doc-types`;

	return {
		list(wid: string): Promise<DocumentType[]> {
			return client.request<DocumentType[]>(base(wid));
		},
		create(wid: string, input: CreateDocTypeInput): Promise<DocumentType> {
			return client.request<DocumentType>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		update(wid: string, id: string, input: UpdateDocTypeInput): Promise<{ updated: boolean }> {
			return client.request<{ updated: boolean }>(`${base(wid)}/${id}`, {
				method: "PUT",
				body: input,
			});
		},
		delete(wid: string, id: string): Promise<{ deleted: boolean }> {
			return client.request<{ deleted: boolean }>(`${base(wid)}/${id}`, {
				method: "DELETE",
			});
		},
	};
}
