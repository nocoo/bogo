import type {
	CreatePersonTableViewInput,
	PersonTableView,
	UpdatePersonTableViewInput,
} from "@bogo/shared";
import type { Client } from "./client.js";

export function tableViewApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/table-views`;

	return {
		list(wid: string): Promise<PersonTableView[]> {
			return client.request<PersonTableView[]>(base(wid));
		},
		get(wid: string, id: string): Promise<PersonTableView> {
			return client.request<PersonTableView>(`${base(wid)}/${id}`);
		},
		create(wid: string, input: CreatePersonTableViewInput): Promise<PersonTableView> {
			return client.request<PersonTableView>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		update(wid: string, id: string, input: UpdatePersonTableViewInput): Promise<PersonTableView> {
			return client.request<PersonTableView>(`${base(wid)}/${id}`, {
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
