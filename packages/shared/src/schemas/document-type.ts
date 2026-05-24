import { z } from "zod/v4";

export const createDocTypeSchema = z.object({
	name: z.string().min(1).max(200),
	color: z.string().max(50).nullable().optional(),
});

export const updateDocTypeSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	color: z.string().max(50).nullable().optional(),
	sortOrder: z.number().int().min(0).optional(),
});

export type CreateDocTypeInput = z.infer<typeof createDocTypeSchema>;
export type UpdateDocTypeInput = z.infer<typeof updateDocTypeSchema>;

export interface DocumentType {
	id: string;
	workspaceId: string;
	name: string;
	color: string | null;
	sortOrder: number;
	createdAt: string;
}
