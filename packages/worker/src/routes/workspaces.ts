import {
	type CreateWorkspaceInput,
	createWorkspaceSchema,
	generateId,
	updateWorkspaceSchema,
	type Workspace,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const workspaceRoutes = new Hono<AppEnv>();

workspaceRoutes.get("/", async (c) => {
	const db = c.env.DB;
	const rows = await db
		.prepare(
			"SELECT id, owner_id, name, created_at, updated_at FROM workspaces ORDER BY created_at DESC",
		)
		.all();

	const workspaces: Workspace[] = rows.results.map(mapRow);
	return c.json({ data: workspaces });
});

workspaceRoutes.post("/", async (c) => {
	const body = await c.req.json();
	const parsed = createWorkspaceSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const input: CreateWorkspaceInput = parsed.data;
	const id = generateId();
	const rootId = generateId();
	const now = new Date().toISOString();

	await c.env.DB.batch([
		c.env.DB.prepare(
			"INSERT INTO workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		).bind(id, "default-owner", input.name, now, now),
		c.env.DB.prepare(
			"INSERT INTO persons (id, workspace_id, name, title, manager_id, is_root, sort_order, created_at, updated_at) VALUES (?, ?, ?, '', NULL, 1, 0, ?, ?)",
		).bind(rootId, id, input.name, now, now),
	]);

	const workspace: Workspace = {
		id,
		ownerId: "default-owner",
		name: input.name,
		createdAt: now,
		updatedAt: now,
	};

	return c.json({ data: workspace }, 201);
});

workspaceRoutes.get("/:id", async (c) => {
	const { id } = c.req.param();
	const row = await c.env.DB.prepare(
		"SELECT id, owner_id, name, created_at, updated_at FROM workspaces WHERE id = ?",
	)
		.bind(id)
		.first();

	if (!row) {
		return c.json({ error: { code: "NOT_FOUND", message: "Workspace not found" } }, 404);
	}

	return c.json({ data: mapRow(row) });
});

workspaceRoutes.put("/:id", async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = updateWorkspaceSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const now = new Date().toISOString();
	const result = await c.env.DB.prepare(
		"UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?",
	)
		.bind(parsed.data.name, now, id)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Workspace not found" } }, 404);
	}

	const row = await c.env.DB.prepare(
		"SELECT id, owner_id, name, created_at, updated_at FROM workspaces WHERE id = ?",
	)
		.bind(id)
		.first();

	return c.json({ data: mapRow(row as Record<string, unknown>) });
});

workspaceRoutes.delete("/:id", async (c) => {
	const { id } = c.req.param();
	const result = await c.env.DB.prepare("DELETE FROM workspaces WHERE id = ?").bind(id).run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Workspace not found" } }, 404);
	}

	return c.json({ data: { deleted: true } });
});

function mapRow(row: Record<string, unknown>): Workspace {
	return {
		id: row.id as string,
		ownerId: row.owner_id as string,
		name: row.name as string,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}
