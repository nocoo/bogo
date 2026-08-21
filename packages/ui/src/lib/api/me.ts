import type { Client } from "./client.js";

export interface Me {
	email: string | null;
	name: string | null;
	avatar: string | null;
}

export function meApi(client: Client) {
	return {
		get(): Promise<Me> {
			return client.request<Me>("/api/me");
		},
	};
}
