import { createClient } from "./client.js";
import { docTypeApi } from "./doc-types.js";
import { documentApi } from "./documents.js";
import { fieldApi } from "./fields.js";
import { personApi } from "./persons.js";
import { tagApi } from "./tags.js";
import { workspaceApi } from "./workspaces.js";

export { ApiError, createClient } from "./client.js";
export type { Client } from "./client.js";

export function createApi(baseUrl = "") {
	const client = createClient(baseUrl);
	return {
		workspaces: workspaceApi(client),
		persons: personApi(client),
		fields: fieldApi(client),
		docTypes: docTypeApi(client),
		documents: documentApi(client),
		tags: tagApi(client),
	};
}

export type Api = ReturnType<typeof createApi>;

export const api = createApi();
