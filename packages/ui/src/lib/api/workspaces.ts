import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@bogo/shared";
import type { Client } from "./client.js";

export function workspaceApi(client: Client) {
	return {
		list(): Promise<Workspace[]> {
			return client.request<Workspace[]>("/api/workspaces");
		},
		get(id: string): Promise<Workspace> {
			return client.request<Workspace>(`/api/workspaces/${id}`);
		},
		create(input: CreateWorkspaceInput): Promise<Workspace> {
			return client.request<Workspace>("/api/workspaces", {
				method: "POST",
				body: input,
			});
		},
		update(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
			return client.request<Workspace>(`/api/workspaces/${id}`, {
				method: "PUT",
				body: input,
			});
		},
		delete(id: string): Promise<{ deleted: boolean }> {
			return client.request<{ deleted: boolean }>(`/api/workspaces/${id}`, {
				method: "DELETE",
			});
		},
	};
}
