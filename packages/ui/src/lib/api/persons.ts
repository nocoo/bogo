import type {
	CreatePersonInput,
	Document,
	MovePersonInput,
	Person,
	UpdatePersonInput,
} from "@bogo/shared";
import type { Client } from "./client.js";

export function personApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/persons`;

	return {
		list(wid: string, tagIds?: string[]): Promise<Person[]> {
			const url =
				tagIds && tagIds.length > 0 ? `${base(wid)}?tagIds=${tagIds.join(",")}` : base(wid);
			return client.request<Person[]>(url);
		},
		get(wid: string, id: string): Promise<Person> {
			return client.request<Person>(`${base(wid)}/${id}`);
		},
		create(wid: string, input: CreatePersonInput): Promise<Person> {
			return client.request<Person>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		update(wid: string, id: string, input: UpdatePersonInput): Promise<Person> {
			return client.request<Person>(`${base(wid)}/${id}`, {
				method: "PUT",
				body: input,
			});
		},
		move(wid: string, id: string, input: MovePersonInput): Promise<{ moved: boolean }> {
			return client.request<{ moved: boolean }>(`${base(wid)}/${id}/move`, {
				method: "PUT",
				body: input,
			});
		},
		delete(wid: string, id: string): Promise<{ deleted: boolean }> {
			return client.request<{ deleted: boolean }>(`${base(wid)}/${id}`, {
				method: "DELETE",
			});
		},
		listDocuments(wid: string, id: string): Promise<Document[]> {
			return client.request<Document[]>(`${base(wid)}/${id}/documents`);
		},
	};
}
