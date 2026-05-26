export const BOGO_VERSION = "0.1.2";

export interface LiveResponse {
	status: "ok" | "error";
	version: string;
	component: string;
	timestamp: string;
	uptime: number;
}

export { generateId } from "./id.js";

export {
	createWorkspaceSchema,
	updateWorkspaceSchema,
	type CreateWorkspaceInput,
	type UpdateWorkspaceInput,
	type Workspace,
	createPersonSchema,
	updatePersonSchema,
	movePersonSchema,
	type CreatePersonInput,
	type UpdatePersonInput,
	type MovePersonInput,
	type Person,
	fieldTypes,
	createFieldDefSchema,
	updateFieldDefSchema,
	setFieldValueSchema,
	type FieldType,
	type CreateFieldDefInput,
	type UpdateFieldDefInput,
	type SetFieldValueInput,
	type CustomFieldDefinition,
	type CustomFieldValue,
	createDocumentSchema,
	updateDocumentSchema,
	type CreateDocumentInput,
	type UpdateDocumentInput,
	type Document,
	type DocumentVersion,
	type EmbeddedTag,
	createDocTypeSchema,
	updateDocTypeSchema,
	type CreateDocTypeInput,
	type UpdateDocTypeInput,
	type DocumentType,
	addDocPersonSchema,
	type AddDocPersonInput,
	type DocumentPerson,
	tagSchema,
	createTagSchema,
	updateTagSchema,
	tagWithCountSchema,
	tagStatsSchema,
	type Tag,
	type TagScope,
	type TagWithCount,
	type CreateTagInput,
	type UpdateTagInput,
	type TagStats,
} from "./schemas/index.js";
