import type {
	CreateTagInput,
	Tag,
	TagScope,
	TagStats,
	TagWithCount,
	UpdateTagInput,
} from "@bogo/shared";
import type { Client } from "./client.js";

export function tagApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/tags`;

	return {
		list(wid: string, scope?: TagScope, includeCounts?: boolean): Promise<TagWithCount[]> {
			const params = new URLSearchParams();
			if (scope) {
				params.set("scope", scope);
			}
			if (includeCounts) {
				params.set("includeCounts", "true");
			}
			const qs = params.toString();
			return client.request<TagWithCount[]>(qs ? `${base(wid)}?${qs}` : base(wid));
		},
		create(wid: string, input: CreateTagInput): Promise<Tag> {
			return client.request<Tag>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		update(wid: string, id: string, input: UpdateTagInput): Promise<{ updated: boolean }> {
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
		assign(
			wid: string,
			tagId: string,
			entityType: "documents" | "persons",
			entityId: string,
		): Promise<{ assigned: boolean }> {
			return client.request<{ assigned: boolean }>(
				`${base(wid)}/${tagId}/${entityType}/${entityId}`,
				{
					method: "PUT",
				},
			);
		},
		unassign(
			wid: string,
			tagId: string,
			entityType: "documents" | "persons",
			entityId: string,
		): Promise<{ removed: boolean }> {
			return client.request<{ removed: boolean }>(
				`${base(wid)}/${tagId}/${entityType}/${entityId}`,
				{
					method: "DELETE",
				},
			);
		},
		stats(wid: string, scope: TagScope): Promise<TagStats[]> {
			return client.request<TagStats[]>(`${base(wid)}/stats?scope=${scope}`);
		},
	};
}
