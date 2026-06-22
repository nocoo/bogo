import {
	type CustomFieldDefinition,
	type CustomFieldValue,
	createFieldDefSchema,
	generateId,
	setFieldValueSchema,
	updateFieldDefSchema,
} from "@bogo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";

export const fieldRoutes = new Hono<AppEnv>();

fieldRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, field_type, options, sort_order, required, default_value, created_at FROM custom_field_definitions WHERE workspace_id = ? ORDER BY sort_order ASC",
	)
		.bind(wid)
		.all();

	return c.json({ data: rows.results.map(mapDefRow) });
});

fieldRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	// CLI bridge: clip codegen cannot send arrays via body, so the CLI sends
	// `options` as a query CSV (docs/features/02-cli.md §3.4 / §6.1). Split it
	// back into a string[] body field so the existing zod schema validates
	// unchanged. Body-supplied `options` (UI / programmatic callers) wins.
	const optionsCsv = c.req.query("options");
	if (optionsCsv && body.options === undefined) {
		body.options = optionsCsv.split(",").filter(Boolean);
	}
	const parsed = createFieldDefSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const id = generateId();
	const now = new Date().toISOString();
	const options = parsed.data.options ? JSON.stringify(parsed.data.options) : null;

	await c.env.DB.prepare(
		"INSERT INTO custom_field_definitions (id, workspace_id, name, field_type, options, sort_order, required, default_value, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)",
	)
		.bind(
			id,
			wid,
			parsed.data.name,
			parsed.data.fieldType,
			options,
			parsed.data.required ? 1 : 0,
			parsed.data.defaultValue ?? null,
			now,
		)
		.run();

	const def: CustomFieldDefinition = {
		id,
		workspaceId: wid,
		name: parsed.data.name,
		fieldType: parsed.data.fieldType,
		options: parsed.data.options ?? null,
		sortOrder: 0,
		required: parsed.data.required ?? false,
		defaultValue: parsed.data.defaultValue ?? null,
		createdAt: now,
	};

	return c.json({ data: def }, 201);
});

fieldRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	// CLI bridge: same options-as-CSV treatment as POST /. See note above.
	const optionsCsv = c.req.query("options");
	if (optionsCsv && body.options === undefined) {
		body.options = optionsCsv.split(",").filter(Boolean);
	}
	const parsed = updateFieldDefSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const sets: string[] = [];
	const values: unknown[] = [];

	if (parsed.data.name !== undefined) {
		sets.push("name = ?");
		values.push(parsed.data.name);
	}
	if (parsed.data.fieldType !== undefined) {
		sets.push("field_type = ?");
		values.push(parsed.data.fieldType);
	}
	if (parsed.data.options !== undefined) {
		sets.push("options = ?");
		values.push(JSON.stringify(parsed.data.options));
	}
	if (parsed.data.required !== undefined) {
		sets.push("required = ?");
		values.push(parsed.data.required ? 1 : 0);
	}
	if (parsed.data.defaultValue !== undefined) {
		sets.push("default_value = ?");
		values.push(parsed.data.defaultValue);
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
		`UPDATE custom_field_definitions SET ${sets.join(", ")} WHERE id = ? AND workspace_id = ?`,
	)
		.bind(...values)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Field definition not found" } }, 404);
	}

	return c.json({ data: { updated: true } });
});

fieldRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const result = await c.env.DB.prepare(
		"DELETE FROM custom_field_definitions WHERE id = ? AND workspace_id = ?",
	)
		.bind(id, wid)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: { code: "NOT_FOUND", message: "Field definition not found" } }, 404);
	}

	return c.json({ data: { deleted: true } });
});

// Field values for a person
fieldRoutes.get("/values/:personId", async (c) => {
	const wid = c.req.param("wid") as string;
	const { personId } = c.req.param();
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, person_id, field_def_id, value FROM custom_field_values WHERE workspace_id = ? AND person_id = ?",
	)
		.bind(wid, personId)
		.all();

	return c.json({ data: rows.results.map(mapValueRow) });
});

fieldRoutes.put("/values/:personId/:fieldDefId", async (c) => {
	const wid = c.req.param("wid") as string;
	const { personId, fieldDefId } = c.req.param();
	const body = await c.req.json();
	const parsed = setFieldValueSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const fieldDef = await c.env.DB.prepare(
		"SELECT field_type, options FROM custom_field_definitions WHERE id = ? AND workspace_id = ?",
	)
		.bind(fieldDefId, wid)
		.first();
	if (!fieldDef) {
		return c.json(
			{ error: { code: "NOT_FOUND", message: "Field definition not found in workspace" } },
			404,
		);
	}

	const person = await c.env.DB.prepare("SELECT id FROM persons WHERE id = ? AND workspace_id = ?")
		.bind(personId, wid)
		.first();
	if (!person) {
		return c.json({ error: { code: "NOT_FOUND", message: "Person not found in workspace" } }, 404);
	}

	const fieldType = fieldDef.field_type as string;
	const value = parsed.data.value;
	const validationError = validateFieldValue(fieldType, value, fieldDef.options as string | null);
	if (validationError) {
		return c.json({ error: { code: "INVALID_VALUE", message: validationError } }, 400);
	}

	const id = generateId();
	await c.env.DB.prepare(
		"INSERT INTO custom_field_values (id, workspace_id, person_id, field_def_id, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT (person_id, field_def_id) DO UPDATE SET value = excluded.value",
	)
		.bind(id, wid, personId, fieldDefId, parsed.data.value)
		.run();

	return c.json({ data: { personId, fieldDefId, value: parsed.data.value } });
});

function mapDefRow(row: Record<string, unknown>): CustomFieldDefinition {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		name: row.name as string,
		fieldType: row.field_type as CustomFieldDefinition["fieldType"],
		options: row.options ? JSON.parse(row.options as string) : null,
		sortOrder: row.sort_order as number,
		required: row.required === 1,
		defaultValue: (row.default_value as string) || null,
		createdAt: row.created_at as string,
	};
}

function validateFieldValue(
	fieldType: string,
	value: string,
	optionsJson: string | null,
): string | null {
	switch (fieldType) {
		case "number": {
			const n = Number(value);
			if (value.trim() === "" || Number.isNaN(n) || !Number.isFinite(n)) {
				return "Value must be a valid finite number";
			}
			break;
		}
		case "date": {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				return "Value must be a valid date (YYYY-MM-DD)";
			}
			const [y, m, d] = value.split("-").map(Number);
			const date = new Date(y, m - 1, d);
			if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
				return "Value must be a valid date (YYYY-MM-DD)";
			}
			break;
		}
		case "boolean":
			if (value !== "true" && value !== "false") {
				return "Value must be 'true' or 'false'";
			}
			break;
		case "select": {
			if (!optionsJson) {
				return "Field has no options defined";
			}
			const options: string[] = JSON.parse(optionsJson);
			if (!options.includes(value)) {
				return `Value must be one of: ${options.join(", ")}`;
			}
			break;
		}
		default:
			break;
	}
	return null;
}

function mapValueRow(row: Record<string, unknown>): CustomFieldValue {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		personId: row.person_id as string,
		fieldDefId: row.field_def_id as string,
		value: row.value as string,
	};
}
