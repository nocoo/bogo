import { z } from "zod/v4";

const TAG_SCOPES = ["document", "person"] as const;
const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const tagSchema = z.object({
	id: z.string(),
	workspaceId: z.string(),
	name: z.string().min(1).max(50),
	scope: z.enum(TAG_SCOPES),
	color: HEX_COLOR.nullable(),
	sortOrder: z.number().int(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const createTagSchema = z.object({
	name: z.string().min(1).max(50),
	scope: z.enum(TAG_SCOPES),
	color: HEX_COLOR.nullable().optional(),
	sortOrder: z.number().int().optional(),
});

export const updateTagSchema = z.object({
	name: z.string().min(1).max(50).optional(),
	color: HEX_COLOR.nullable().optional(),
	sortOrder: z.number().int().optional(),
});

export const tagWithCountSchema = tagSchema.extend({
	assignedCount: z.number().int(),
});

export const tagStatsSchema = z.object({
	id: z.string(),
	name: z.string(),
	color: HEX_COLOR.nullable(),
	sortOrder: z.number().int(),
	count: z.number().int(),
});

export type Tag = z.infer<typeof tagSchema>;
export type TagScope = (typeof TAG_SCOPES)[number];
export type TagWithCount = z.infer<typeof tagWithCountSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagStats = z.infer<typeof tagStatsSchema>;
