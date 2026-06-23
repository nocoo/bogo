export const BOGO_VERSION = "0.5.0";

export interface LiveResponse {
	status: "ok" | "error";
	version: string;
	component: string;
	timestamp: string;
	uptime: number;
}

export { generateId } from "./id.js";

export {
	type AddDocPersonInput,
	addDocPersonSchema,
	type CreateDocTypeInput,
	type CreateDocumentInput,
	type CreateFieldDefInput,
	type CreatePersonInput,
	type CreateTagInput,
	type CreateWorkspaceInput,
	type CustomFieldDefinition,
	type CustomFieldValue,
	createDocTypeSchema,
	createDocumentSchema,
	createFieldDefSchema,
	createPersonSchema,
	createTagSchema,
	createWorkspaceSchema,
	type Document,
	type DocumentPerson,
	type DocumentSummary,
	type DocumentType,
	type DocumentVersion,
	type DocumentVersionSummary,
	type EmbeddedTag,
	type FieldType,
	fieldTypes,
	type MovePersonInput,
	movePersonSchema,
	type Person,
	type SetFieldValueInput,
	setFieldValueSchema,
	type Tag,
	type TagScope,
	type TagStats,
	type TagWithCount,
	tagSchema,
	tagStatsSchema,
	tagWithCountSchema,
	type UpdateDocTypeInput,
	type UpdateDocumentInput,
	type UpdateFieldDefInput,
	type UpdatePersonInput,
	type UpdateTagInput,
	type UpdateWorkspaceInput,
	updateDocTypeSchema,
	updateDocumentSchema,
	updateFieldDefSchema,
	updatePersonSchema,
	updateTagSchema,
	updateWorkspaceSchema,
	type Workspace,
} from "./schemas/index.js";
