import type {
	CreateFieldDefInput,
	CustomFieldDefinition,
	CustomFieldValue,
	SetFieldValueInput,
	UpdateFieldDefInput,
} from "@bogo/shared";
import type { Client } from "./client.js";

export interface FieldValueResult {
	personId: string;
	fieldDefId: string;
	value: string;
}

export function fieldApi(client: Client) {
	const base = (wid: string) => `/api/w/${wid}/fields`;

	return {
		listDefs(wid: string): Promise<CustomFieldDefinition[]> {
			return client.request<CustomFieldDefinition[]>(base(wid));
		},
		createDef(wid: string, input: CreateFieldDefInput): Promise<CustomFieldDefinition> {
			return client.request<CustomFieldDefinition>(base(wid), {
				method: "POST",
				body: input,
			});
		},
		updateDef(wid: string, id: string, input: UpdateFieldDefInput): Promise<{ updated: boolean }> {
			return client.request<{ updated: boolean }>(`${base(wid)}/${id}`, {
				method: "PUT",
				body: input,
			});
		},
		deleteDef(wid: string, id: string): Promise<{ deleted: boolean }> {
			return client.request<{ deleted: boolean }>(`${base(wid)}/${id}`, {
				method: "DELETE",
			});
		},
		getValues(wid: string, personId: string): Promise<CustomFieldValue[]> {
			return client.request<CustomFieldValue[]>(`${base(wid)}/values/${personId}`);
		},
		listAllValues(wid: string): Promise<CustomFieldValue[]> {
			return client.request<CustomFieldValue[]>(`${base(wid)}/values`);
		},
		setValue(
			wid: string,
			personId: string,
			fieldDefId: string,
			input: SetFieldValueInput,
		): Promise<FieldValueResult> {
			return client.request<FieldValueResult>(`${base(wid)}/values/${personId}/${fieldDefId}`, {
				method: "PUT",
				body: input,
			});
		},
	};
}
