import { z } from "zod/v4";

export const createDocumentSchema = z.object({
	title: z.string().min(1).max(500),
	content: z.string().optional().default(""),
	typeId: z.string().uuid().nullable().optional(),
	eventDate: z.string().date().nullable().optional(),
	personIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateDocumentSchema = z.object({
	title: z.string().min(1).max(500).optional(),
	content: z.string().optional(),
	typeId: z.string().uuid().nullable().optional(),
	eventDate: z.string().date().nullable().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export interface EmbeddedTag {
	id: string;
	name: string;
	color: string | null;
}

export interface Document {
	id: string;
	workspaceId: string;
	typeId: string | null;
	title: string;
	content: string;
	eventDate: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
	tags: EmbeddedTag[];
	/** Person IDs associated with this document; hydrated by the list API.
	 * Only the IDs are sent — the UI is expected to look up display info
	 * (name, avatar) from its own person cache. May be omitted on responses
	 * from older endpoints that don't carry it. */
	personIds?: string[];
}

export interface DocumentVersion {
	id: string;
	documentId: string;
	version: number;
	title: string;
	content: string;
	createdAt: string;
}
