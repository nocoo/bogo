import { z } from "zod/v4";

export const createPersonSchema = z.object({
	name: z.string().min(1).max(200),
	title: z.string().max(200).optional().default(""),
	managerId: z.string().uuid().nullable(),
	dottedManagerId: z.string().uuid().nullable().optional(),
	avatarUrl: z.string().max(2048).nullable().optional(),
});

export const updatePersonSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	title: z.string().max(200).optional(),
	dottedManagerId: z.string().uuid().nullable().optional(),
	avatarUrl: z.string().max(2048).nullable().optional(),
});

export const movePersonSchema = z.object({
	managerId: z.string().uuid().nullable(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type MovePersonInput = z.infer<typeof movePersonSchema>;

import type { EmbeddedTag } from "./document.js";

export interface Person {
	id: string;
	workspaceId: string;
	name: string;
	title: string;
	managerId: string | null;
	dottedManagerId: string | null;
	avatarUrl: string | null;
	isRoot: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	tags: EmbeddedTag[];
}
