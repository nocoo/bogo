import type {
	AddDocPersonInput,
	CreateDocumentInput,
	Document,
	DocumentPerson,
	DocumentVersion,
	UpdateDocumentInput,
} from "@bogo/shared";
import type { Client } from "./client.js";

export function documentApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/documents`;

	return {
		list(wid: string): Promise<Document[]> {
			return client.request<Document[]>(base(wid));
		},
		get(wid: string, id: string): Promise<Document> {
			return client.request<Document>(`${base(wid)}/${id}`);
		},
		create(wid: string, input: CreateDocumentInput): Promise<Document> {
			return client.request<Document>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		update(wid: string, id: string, input: UpdateDocumentInput): Promise<Document> {
			return client.request<Document>(`${base(wid)}/${id}`, {
				method: "PUT",
				body: input,
			});
		},
		delete(wid: string, id: string): Promise<{ deleted: boolean }> {
			return client.request<{ deleted: boolean }>(`${base(wid)}/${id}`, {
				method: "DELETE",
			});
		},
		listVersions(wid: string, id: string): Promise<DocumentVersion[]> {
			return client.request<DocumentVersion[]>(`${base(wid)}/${id}/versions`);
		},
		listPersons(wid: string, id: string): Promise<DocumentPerson[]> {
			return client.request<DocumentPerson[]>(`${base(wid)}/${id}/persons`);
		},
		addPerson(wid: string, id: string, input: AddDocPersonInput): Promise<DocumentPerson> {
			return client.request<DocumentPerson>(`${base(wid)}/${id}/persons`, {
				method: "POST",
				body: input,
			});
		},
		removePerson(wid: string, docId: string, personId: string): Promise<{ removed: boolean }> {
			return client.request<{ removed: boolean }>(`${base(wid)}/${docId}/persons/${personId}`, {
				method: "DELETE",
			});
		},
	};
}
