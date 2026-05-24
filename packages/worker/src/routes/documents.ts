import {
	type Document,
	type DocumentVersion,
	addDocPersonSchema,
	createDocumentSchema,
	generateId,
	updateDocumentSchema,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const documentRoutes = new Hono<AppEnv>();

documentRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, type_id, title, content, event_date, version, created_at, updated_at FROM documents WHERE workspace_id = ? ORDER BY event_date DESC NULLS LAST, created_at DESC",
	)
		.bind(wid)
		.all();

	return c.json({ data: rows.results.map(mapDocRow) });
});

documentRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = await c.req.json();
	const parsed = createDocumentSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	if (parsed.data.typeId) {
		const docType = await c.env.DB.prepare(
			"SELECT id FROM document_types WHERE id = ? AND workspace_id = ?",
		)
			.bind(parsed.data.typeId, wid)
			.first();
		if (!docType) {
			return c.json(
				{ error: { code: "INVALID_TYPE", message: "Document type not found in workspace" } },
				400,
			);
		}
	}

	const personIds = parsed.data.personIds ?? [];
	for (const personId of personIds) {
		const person = await c.env.DB.prepare(
			"SELECT id FROM persons WHERE id = ? AND workspace_id = ?",
		)
			.bind(personId, wid)
			.first();
		if (!person) {
			return c.json(
				{
					error: {
						code: "INVALID_PERSON",
						message: `Person ${personId} not found in workspace`,
					},
				},
				400,
			);
		}
	}

	const id = generateId();
	const versionId = generateId();
	const now = new Date().toISOString();

	const batch = [
		c.env.DB.prepare(
			"INSERT INTO documents (id, workspace_id, type_id, title, content, event_date, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
		).bind(
			id,
			wid,
			parsed.data.typeId ?? null,
			parsed.data.title,
			parsed.data.content ?? "",
			parsed.data.eventDate ?? null,
			now,
			now,
		),
		c.env.DB.prepare(
			"INSERT INTO document_versions (id, document_id, version, title, content, created_at) VALUES (?, ?, 1, ?, ?, ?)",
		).bind(versionId, id, parsed.data.title, parsed.data.content ?? "", now),
	];

	for (const personId of personIds) {
		batch.push(
			c.env.DB.prepare(
				"INSERT INTO document_persons (workspace_id, document_id, person_id, role) VALUES (?, ?, ?, 'subject')",
			).bind(wid, id, personId),
		);
	}

	await c.env.DB.batch(batch);

	const doc: Document = {
		id,
		workspaceId: wid,
		typeId: parsed.data.typeId ?? null,
		title: parsed.data.title,
		content: parsed.data.content ?? "",
		eventDate: parsed.data.eventDate ?? null,
		version: 1,
		createdAt: now,
		updatedAt: now,
	};

	return c.json({ data: doc }, 201);
});

documentRoutes.get("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const row = await c.env.DB.prepare(
		"SELECT id, workspace_id, type_id, title, content, event_date, version, created_at, updated_at FROM documents WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (!row) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
	}

	return c.json({ data: mapDocRow(row) });
});

documentRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = updateDocumentSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const existing = await c.env.DB.prepare(
		"SELECT version, title, content FROM documents WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.first();

	if (!existing) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
	}

	const currentVersion = existing.version as number;
	const newVersion = currentVersion + 1;
	const now = new Date().toISOString();

	const sets: string[] = ["version = ?", "updated_at = ?"];
	const values: unknown[] = [newVersion, now];

	const newTitle = parsed.data.title ?? (existing.title as string);
	const newContent = parsed.data.content ?? (existing.content as string);

	if (parsed.data.title !== undefined) {
		sets.push("title = ?");
		values.push(parsed.data.title);
	}
	if (parsed.data.content !== undefined) {
		sets.push("content = ?");
		values.push(parsed.data.content);
	}
	if (parsed.data.typeId !== undefined) {
		if (parsed.data.typeId !== null) {
			const docType = await c.env.DB.prepare(
				"SELECT id FROM document_types WHERE id = ? AND workspace_id = ?",
			)
				.bind(parsed.data.typeId, wid)
				.first();
			if (!docType) {
				return c.json(
					{ error: { code: "INVALID_TYPE", message: "Document type not found in workspace" } },
					400,
				);
			}
		}
		sets.push("type_id = ?");
		values.push(parsed.data.typeId);
	}
	if (parsed.data.eventDate !== undefined) {
		sets.push("event_date = ?");
		values.push(parsed.data.eventDate);
	}

	values.push(id);
	values.push(wid);

	const versionId = generateId();

	await c.env.DB.batch([
		c.env.DB.prepare(
			`UPDATE documents SET ${sets.join(", ")} WHERE id = ? AND workspace_id = ?`,
		).bind(...values),
		c.env.DB.prepare(
			"INSERT INTO document_versions (id, document_id, version, title, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(versionId, id, newVersion, newTitle, newContent, now),
	]);

	return c.json({ data: { version: newVersion } });
});

documentRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const result = await c.env.DB.prepare("DELETE FROM documents WHERE id = ? AND workspace_id = ?")
		.bind(id, wid)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
	}

	return c.json({ data: { deleted: true } });
});

// Document versions
documentRoutes.get("/:id/versions", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();

	const doc = await c.env.DB.prepare("SELECT id FROM documents WHERE id = ? AND workspace_id = ?")
		.bind(id, wid)
		.first();
	if (!doc) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
	}

	const rows = await c.env.DB.prepare(
		"SELECT id, document_id, version, title, content, created_at FROM document_versions WHERE document_id = ? ORDER BY version DESC",
	)
		.bind(id)
		.all();

	const versions: DocumentVersion[] = rows.results.map((row) => ({
		id: row.id as string,
		documentId: row.document_id as string,
		version: row.version as number,
		title: row.title as string,
		content: row.content as string,
		createdAt: row.created_at as string,
	}));

	return c.json({ data: versions });
});

// Document-person associations
documentRoutes.get("/:id/persons", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const rows = await c.env.DB.prepare(
		"SELECT workspace_id, document_id, person_id, role FROM document_persons WHERE workspace_id = ? AND document_id = ?",
	)
		.bind(wid, id)
		.all();

	return c.json({
		data: rows.results.map((row) => ({
			workspaceId: row.workspace_id as string,
			documentId: row.document_id as string,
			personId: row.person_id as string,
			role: row.role as string,
		})),
	});
});

documentRoutes.post("/:id/persons", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = await c.req.json();
	const parsed = addDocPersonSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const doc = await c.env.DB.prepare("SELECT id FROM documents WHERE id = ? AND workspace_id = ?")
		.bind(id, wid)
		.first();
	if (!doc) {
		return c.json({ error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
	}

	const person = await c.env.DB.prepare("SELECT id FROM persons WHERE id = ? AND workspace_id = ?")
		.bind(parsed.data.personId, wid)
		.first();
	if (!person) {
		return c.json(
			{ error: { code: "INVALID_PERSON", message: "Person not found in workspace" } },
			400,
		);
	}

	await c.env.DB.prepare(
		"INSERT OR IGNORE INTO document_persons (workspace_id, document_id, person_id, role) VALUES (?, ?, ?, ?)",
	)
		.bind(wid, id, parsed.data.personId, parsed.data.role ?? "subject")
		.run();

	return c.json({ data: { added: true } }, 201);
});

documentRoutes.delete("/:id/persons/:personId", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id, personId } = c.req.param();
	const result = await c.env.DB.prepare(
		"DELETE FROM document_persons WHERE workspace_id = ? AND document_id = ? AND person_id = ?",
	)
		.bind(wid, id, personId)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Association not found" } }, 404);
	}

	return c.json({ data: { removed: true } });
});

function mapDocRow(row: Record<string, unknown>): Document {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		typeId: (row.type_id as string) || null,
		title: row.title as string,
		content: row.content as string,
		eventDate: (row.event_date as string) || null,
		version: row.version as number,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}
