import { z } from "zod/v4";

export const fieldTypes = ["text", "number", "date", "select", "boolean"] as const;

export type FieldType = (typeof fieldTypes)[number];

export const createFieldDefSchema = z.object({
	name: z.string().min(1).max(200),
	fieldType: z.enum(fieldTypes),
	options: z.array(z.string()).optional(),
	required: z.boolean().optional().default(false),
	defaultValue: z.string().nullable().optional(),
	showOnChart: z.boolean().optional().default(false),
});

export const updateFieldDefSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	fieldType: z.enum(fieldTypes).optional(),
	options: z.array(z.string()).optional(),
	required: z.boolean().optional(),
	defaultValue: z.string().nullable().optional(),
	sortOrder: z.number().int().min(0).optional(),
	showOnChart: z.boolean().optional(),
});

export const setFieldValueSchema = z.object({
	value: z.string(),
});

export type CreateFieldDefInput = z.input<typeof createFieldDefSchema>;
export type UpdateFieldDefInput = z.input<typeof updateFieldDefSchema>;
export type SetFieldValueInput = z.infer<typeof setFieldValueSchema>;

export interface CustomFieldDefinition {
	id: string;
	workspaceId: string;
	name: string;
	fieldType: FieldType;
	options: string[] | null;
	sortOrder: number;
	required: boolean;
	defaultValue: string | null;
	/** When true, this field's value is rendered under each person's node in
	 * the org chart, ordered by `sortOrder`. Defaults to false — existing
	 * fields stay off until the workspace owner opts in. */
	showOnChart: boolean;
	createdAt: string;
}

export interface CustomFieldValue {
	id: string;
	workspaceId: string;
	personId: string;
	fieldDefId: string;
	value: string;
}
