import {
	createDocTypeSchema,
	type DocumentType,
	generateId,
	updateDocTypeSchema,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const docTypeRoutes = new Hono<AppEnv>();

docTypeRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, color, sort_order, created_at FROM document_types WHERE workspace_id = ? ORDER BY sort_order ASC",
	)
		.bind(wid)
		.all();

	return c.json({ data: rows.results.map(mapRow) });
});

docTypeRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = await c.req.json();
	const parsed = createDocTypeSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const id = generateId();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		"INSERT INTO document_types (id, workspace_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?)",
	)
		.bind(id, wid, parsed.data.name, parsed.data.color ?? null, now)
		.run();

	const docType: DocumentType = {
		id,
		workspaceId: wid,
		name: parsed.data.name,
		color: parsed.data.color ?? null,
		sortOrder: 0,
		createdAt: now,
	};

	return c.json({ data: docType }, 201);
});

docTypeRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = updateDocTypeSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const sets: string[] = [];
	const values: unknown[] = [];

	if (parsed.data.name !== undefined) {
		sets.push("name = ?");
		values.push(parsed.data.name);
	}
	if (parsed.data.color !== undefined) {
		sets.push("color = ?");
		values.push(parsed.data.color);
	}
	if (parsed.data.sortOrder !== undefined) {
		sets.push("sort_order = ?");
		values.push(parsed.data.sortOrder);
	}

	if (sets.length === 0) {
		return c.json({ data: { updated: false } });
	}

	values.push(id);
	values.push(wid);

	const result = await c.env.DB.prepare(
		`UPDATE document_types SET ${sets.join(", ")} WHERE id = ? AND workspace_id = ?`,
	)
		.bind(...values)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document type not found" } }, 404);
	}

	return c.json({ data: { updated: true } });
});

docTypeRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();

	const usage = await c.env.DB.prepare(
		"SELECT id FROM documents WHERE type_id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (usage) {
		return c.json(
			{
				error: {
					code: "TYPE_IN_USE",
					message: "Cannot delete document type that is in use by documents",
				},
			},
			409,
		);
	}

	const result = await c.env.DB.prepare(
		"DELETE FROM document_types WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document type not found" } }, 404);
	}

	return c.json({ data: { deleted: true } });
});

function mapRow(row: Record<string, unknown>): DocumentType {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		name: row.name as string,
		color: (row.color as string) || null,
		sortOrder: row.sort_order as number,
		createdAt: row.created_at as string,
	};
}
