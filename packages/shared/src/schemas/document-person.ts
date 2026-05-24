import { z } from "zod/v4";

export const addDocPersonSchema = z.object({
	personId: z.string().uuid(),
	role: z.string().min(1).max(100).optional().default("subject"),
});

export type AddDocPersonInput = z.infer<typeof addDocPersonSchema>;

export interface DocumentPerson {
	workspaceId: string;
	documentId: string;
	personId: string;
	role: string;
}
