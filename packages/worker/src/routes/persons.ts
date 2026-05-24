import {
	type CreatePersonInput,
	type Person,
	createPersonSchema,
	generateId,
	movePersonSchema,
	updatePersonSchema,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const personRoutes = new Hono<AppEnv>();

personRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, title, manager_id, dotted_manager_id, is_root, sort_order, created_at, updated_at FROM persons WHERE workspace_id = ? ORDER BY sort_order ASC",
	)
		.bind(wid)
		.all();

	return c.json({ data: rows.results.map(mapRow) });
});

personRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = await c.req.json();
	const parsed = createPersonSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const input: CreatePersonInput = parsed.data;

	if (input.managerId === null) {
		return c.json(
			{
				error: {
					code: "CANNOT_CREATE_ROOT",
					message: "Root person is created automatically with workspace",
				},
			},
			400,
		);
	}

	const parent = await c.env.DB.prepare("SELECT id FROM persons WHERE id = ? AND workspace_id = ?")
		.bind(input.managerId, wid)
		.first();
	if (!parent) {
		return c.json(
			{ error: { code: "INVALID_PARENT", message: "Manager not found in workspace" } },
			400,
		);
	}

	if (input.dottedManagerId) {
		const dotted = await c.env.DB.prepare(
			"SELECT id FROM persons WHERE id = ? AND workspace_id = ?",
		)
			.bind(input.dottedManagerId, wid)
			.first();
		if (!dotted) {
			return c.json(
				{
					error: {
						code: "INVALID_DOTTED_MANAGER",
						message: "Dotted manager not found in workspace",
					},
				},
				400,
			);
		}
	}

	const id = generateId();
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		"INSERT INTO persons (id, workspace_id, name, title, manager_id, dotted_manager_id, is_root, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
	)
		.bind(
			id,
			wid,
			input.name,
			input.title ?? "",
			input.managerId,
			input.dottedManagerId ?? null,
			now,
			now,
		)
		.run();

	const person: Person = {
		id,
		workspaceId: wid,
		name: input.name,
		title: input.title ?? "",
		managerId: input.managerId,
		dottedManagerId: input.dottedManagerId ?? null,
		isRoot: false,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
	};

	return c.json({ data: person }, 201);
});

personRoutes.get("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const row = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, title, manager_id, dotted_manager_id, is_root, sort_order, created_at, updated_at FROM persons WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (!row) {
		return c.json({ error: { code: "NOT_FOUND", message: "Person not found" } }, 404);
	}

	return c.json({ data: mapRow(row) });
});

personRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = updatePersonSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const existing = await c.env.DB.prepare(
		"SELECT id FROM persons WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();
	if (!existing) {
		return c.json({ error: { code: "NOT_FOUND", message: "Person not found" } }, 404);
	}

	const sets: string[] = [];
	const values: unknown[] = [];

	if (parsed.data.name !== undefined) {
		sets.push("name = ?");
		values.push(parsed.data.name);
	}
	if (parsed.data.title !== undefined) {
		sets.push("title = ?");
		values.push(parsed.data.title);
	}
	if (parsed.data.dottedManagerId !== undefined) {
		if (parsed.data.dottedManagerId !== null) {
			const dotted = await c.env.DB.prepare(
				"SELECT id FROM persons WHERE id = ? AND workspace_id = ?",
			)
				.bind(parsed.data.dottedManagerId, wid)
				.first();
			if (!dotted) {
				return c.json(
					{
						error: {
							code: "INVALID_DOTTED_MANAGER",
							message: "Dotted manager not found in workspace",
						},
					},
					400,
				);
			}
		}
		sets.push("dotted_manager_id = ?");
		values.push(parsed.data.dottedManagerId);
	}

	if (sets.length === 0) {
		return c.json({ data: { updated: false } });
	}

	const now = new Date().toISOString();
	sets.push("updated_at = ?");
	values.push(now);
	values.push(id);
	values.push(wid);

	await c.env.DB.prepare(`UPDATE persons SET ${sets.join(", ")} WHERE id = ? AND workspace_id = ?`)
		.bind(...values)
		.run();

	const row = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, title, manager_id, dotted_manager_id, is_root, sort_order, created_at, updated_at FROM persons WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	return c.json({ data: mapRow(row as Record<string, unknown>) });
});

personRoutes.put("/:id/move", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = movePersonSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const newManagerId: string | null = parsed.data.managerId ?? null;

	const person = await c.env.DB.prepare(
		"SELECT id, is_root FROM persons WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();
	if (!person) {
		return c.json({ error: { code: "NOT_FOUND", message: "Person not found" } }, 404);
	}

	if (person.is_root === 1 && newManagerId !== null) {
		return c.json(
			{ error: { code: "CANNOT_MOVE_ROOT", message: "Cannot move root person under a manager" } },
			400,
		);
	}

	if (newManagerId === null) {
		const existingRoot = await c.env.DB.prepare(
			"SELECT id FROM persons WHERE workspace_id = ? AND is_root = 1 AND id != ?",
		)
			.bind(wid, id)
			.first();
		if (existingRoot) {
			return c.json(
				{ error: { code: "CONFLICT", message: "Workspace already has a root person" } },
				409,
			);
		}
	} else {
		if (newManagerId === id) {
			return c.json(
				{ error: { code: "CYCLE_DETECTED", message: "Cannot move person under itself" } },
				400,
			);
		}

		const parent = await c.env.DB.prepare(
			"SELECT id FROM persons WHERE id = ? AND workspace_id = ?",
		)
			.bind(newManagerId, wid)
			.first();
		if (!parent) {
			return c.json(
				{ error: { code: "INVALID_PARENT", message: "New manager not found in workspace" } },
				400,
			);
		}

		const wouldCycle = await detectCycle(c.env.DB, wid, id, newManagerId);
		if (wouldCycle) {
			return c.json(
				{
					error: {
						code: "CYCLE_DETECTED",
						message: "Moving here would create a cycle in the org tree",
					},
				},
				400,
			);
		}
	}

	const isRoot = newManagerId === null ? 1 : 0;
	const now = new Date().toISOString();

	await c.env.DB.prepare(
		"UPDATE persons SET manager_id = ?, is_root = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
	)
		.bind(newManagerId, isRoot, now, id, wid)
		.run();

	return c.json({ data: { moved: true } });
});

personRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();

	const person = await c.env.DB.prepare(
		"SELECT id, is_root FROM persons WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (!person) {
		return c.json({ error: { code: "NOT_FOUND", message: "Person not found" } }, 404);
	}

	if (person.is_root === 1) {
		return c.json(
			{ error: { code: "CANNOT_DELETE_ROOT", message: "Cannot delete root person" } },
			400,
		);
	}

	const children = await c.env.DB.prepare(
		"SELECT id FROM persons WHERE manager_id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (children) {
		return c.json(
			{
				error: {
					code: "HAS_REPORTS",
					message: "Cannot delete person with direct reports. Reassign them first.",
				},
			},
			400,
		);
	}

	await c.env.DB.prepare("DELETE FROM persons WHERE id = ? AND workspace_id = ?")
		.bind(id, wid)
		.run();

	return c.json({ data: { deleted: true } });
});

export async function detectCycle(
	db: D1Database,
	workspaceId: string,
	personId: string,
	newManagerId: string,
): Promise<boolean> {
	let current: string | null = newManagerId;
	const visited = new Set<string>();

	while (current) {
		if (current === personId) {
			return true;
		}
		if (visited.has(current)) {
			return false;
		}
		visited.add(current);

		const row: Record<string, unknown> | null = await db
			.prepare("SELECT manager_id FROM persons WHERE id = ? AND workspace_id = ?")
			.bind(current, workspaceId)
			.first();
		current = row ? (row.manager_id as string | null) : null;
	}

	return false;
}

function mapRow(row: Record<string, unknown>): Person {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		name: row.name as string,
		title: row.title as string,
		managerId: (row.manager_id as string) || null,
		dottedManagerId: (row.dotted_manager_id as string) || null,
		isRoot: row.is_root === 1,
		sortOrder: row.sort_order as number,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}
