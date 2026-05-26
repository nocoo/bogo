export {
	createWorkspaceSchema,
	updateWorkspaceSchema,
	type CreateWorkspaceInput,
	type UpdateWorkspaceInput,
	type Workspace,
} from "./workspace.js";

export {
	createPersonSchema,
	updatePersonSchema,
	movePersonSchema,
	type CreatePersonInput,
	type UpdatePersonInput,
	type MovePersonInput,
	type Person,
} from "./person.js";

export {
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
} from "./custom-field.js";

export {
	createDocumentSchema,
	updateDocumentSchema,
	type CreateDocumentInput,
	type UpdateDocumentInput,
	type Document,
	type DocumentVersion,
} from "./document.js";

export {
	createDocTypeSchema,
	updateDocTypeSchema,
	type CreateDocTypeInput,
	type UpdateDocTypeInput,
	type DocumentType,
} from "./document-type.js";

export {
	addDocPersonSchema,
	type AddDocPersonInput,
	type DocumentPerson,
} from "./document-person.js";

export {
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
} from "./tag.js";
