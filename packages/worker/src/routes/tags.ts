import {
	type Tag,
	type TagWithCount,
	createTagSchema,
	generateId,
	updateTagSchema,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const tagRoutes = new Hono<AppEnv>();

tagRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const scope = c.req.query("scope");
	const includeCounts = c.req.query("includeCounts") === "true";

	let sql: string;
	const params: unknown[] = [wid];

	if (includeCounts && scope) {
		const joinTable = scope === "document" ? "tag_documents" : "tag_persons";
		sql = `SELECT t.id, t.workspace_id, t.name, t.scope, t.color, t.sort_order, t.created_at, t.updated_at, COUNT(j.tag_id) as assigned_count FROM tags t LEFT JOIN ${joinTable} j ON j.workspace_id = t.workspace_id AND j.tag_id = t.id WHERE t.workspace_id = ? AND t.scope = ? GROUP BY t.id ORDER BY t.sort_order ASC, t.name ASC`;
		params.push(scope);
	} else if (scope) {
		sql =
			"SELECT id, workspace_id, name, scope, color, sort_order, created_at, updated_at FROM tags WHERE workspace_id = ? AND scope = ? ORDER BY sort_order ASC, name ASC";
		params.push(scope);
	} else {
		sql =
			"SELECT id, workspace_id, name, scope, color, sort_order, created_at, updated_at FROM tags WHERE workspace_id = ? ORDER BY sort_order ASC, name ASC";
	}

	const rows = await c.env.DB.prepare(sql)
		.bind(...params)
		.all();

	const mapper = includeCounts ? mapRowWithCount : mapRow;
	return c.json({ data: rows.results.map(mapper) });
});

tagRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = await c.req.json();
	const parsed = createTagSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const id = generateId();
	const now = new Date().toISOString();
	const sortOrder = parsed.data.sortOrder ?? 0;

	try {
		await c.env.DB.prepare(
			"INSERT INTO tags (id, workspace_id, name, scope, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(
				id,
				wid,
				parsed.data.name,
				parsed.data.scope,
				parsed.data.color ?? null,
				sortOrder,
				now,
				now,
			)
			.run();
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
			return c.json(
				{
					error: {
						code: "DUPLICATE",
						message: "A tag with this name already exists in this scope",
					},
				},
				409,
			);
		}
		throw e;
	}

	const tag: Tag = {
		id,
		workspaceId: wid,
		name: parsed.data.name,
		scope: parsed.data.scope,
		color: parsed.data.color ?? null,
		sortOrder,
		createdAt: now,
		updatedAt: now,
	};

	return c.json({ data: tag }, 201);
});

tagRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = updateTagSchema.safeParse(body);
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

	sets.push("updated_at = ?");
	values.push(new Date().toISOString());
	values.push(id);
	values.push(wid);

	const result = await c.env.DB.prepare(
		`UPDATE tags SET ${sets.join(", ")} WHERE id = ? AND workspace_id = ?`,
	)
		.bind(...values)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
	}

	return c.json({ data: { updated: true } });
});

tagRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();

	const result = await c.env.DB.prepare("DELETE FROM tags WHERE id = ? AND workspace_id = ?")
		.bind(id, wid)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Tag not found" } }, 404);
	}

	return c.json({ data: { deleted: true } });
});

function mapRow(row: Record<string, unknown>): Tag {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		name: row.name as string,
		scope: row.scope as "document" | "person",
		color: (row.color as string) || null,
		sortOrder: row.sort_order as number,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}

function mapRowWithCount(row: Record<string, unknown>): TagWithCount {
	return {
		...mapRow(row),
		assignedCount: (row.assigned_count as number) ?? 0,
	};
}
