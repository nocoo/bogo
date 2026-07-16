import {
	type ColumnKey,
	createPersonTableViewSchema,
	generateId,
	type PersonTableView,
	updatePersonTableViewSchema,
	type ViewFilter,
	type ViewSort,
} from "@bogo/shared";
import type { D1Database } from "@cloudflare/workers-types";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import {
	type FieldDefMeta,
	parseColumnsJson,
	parseFiltersJson,
	parseSortJson,
	stripRemovedColumnRefs,
	validateColumnsStructure,
	validateFilterAgainstColumn,
	validateNewFieldKeys,
	validateSortAgainstColumns,
} from "./table-view-logic.js";

export const tableViewRoutes = new Hono<AppEnv>();

tableViewRoutes.get("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const rows = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, columns_json, sort_json, filters_json, is_default, sort_order, created_at, updated_at FROM person_table_views WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC, id ASC",
	)
		.bind(wid)
		.all();

	return c.json({ data: rows.results.map(mapRow) });
});

tableViewRoutes.get("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const row = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, columns_json, sort_json, filters_json, is_default, sort_order, created_at, updated_at FROM person_table_views WHERE workspace_id = ? AND id = ?",
	)
		.bind(wid, id)
		.first();

	if (!row) {
		return c.json({ error: { code: "NOT_FOUND", message: "Table view not found" } }, 404);
	}

	return c.json({ data: mapRow(row as Record<string, unknown>) });
});

tableViewRoutes.post("/", async (c) => {
	const wid = c.req.param("wid") as string;
	const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	applyCliBridges(c, body);

	const parsed = createPersonTableViewSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const columns = parsed.data.columns as ColumnKey[];
	const sort: ViewSort = parsed.data.sort !== undefined ? parsed.data.sort : null;
	const filters: ViewFilter[] = parsed.data.filters ?? [];
	const isDefault = parsed.data.isDefault ?? false;

	const structErr = validateColumnsStructure(columns);
	if (structErr) {
		return c.json({ error: { code: "VALIDATION_ERROR", message: structErr } }, 400);
	}

	const defs = await loadFieldDefs(c.env.DB, wid);
	const newFieldErr = validateNewFieldKeys(columns, null, defs);
	if (newFieldErr) {
		return c.json({ error: { code: "UNKNOWN_FIELD", message: newFieldErr } }, 400);
	}
	const sortErr = validateSortAgainstColumns(sort, columns, defs);
	if (sortErr) {
		return c.json({ error: { code: "INVALID_SORT", message: sortErr } }, 400);
	}
	for (const f of filters) {
		const ferr = validateFilterAgainstColumn(f, columns, defs);
		if (ferr) {
			return c.json({ error: { code: "INVALID_FILTER", message: ferr } }, 400);
		}
	}

	const maxRow = await c.env.DB.prepare(
		"SELECT MAX(sort_order) as m FROM person_table_views WHERE workspace_id = ?",
	)
		.bind(wid)
		.first();
	const maxSort =
		maxRow && maxRow.m !== null && maxRow.m !== undefined ? Number(maxRow.m as number) : -1;
	const sortOrder = maxSort + 1;

	const id = generateId();
	const now = new Date().toISOString();

	try {
		const statements = [];
		if (isDefault) {
			statements.push(
				c.env.DB.prepare(
					"UPDATE person_table_views SET is_default = 0 WHERE workspace_id = ? AND is_default = 1",
				).bind(wid),
			);
		}
		statements.push(
			c.env.DB.prepare(
				"INSERT INTO person_table_views (id, workspace_id, name, columns_json, sort_json, filters_json, is_default, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			).bind(
				id,
				wid,
				parsed.data.name,
				JSON.stringify(columns),
				sort === null ? null : JSON.stringify(sort),
				JSON.stringify(filters),
				isDefault ? 1 : 0,
				sortOrder,
				now,
				now,
			),
		);
		await c.env.DB.batch(statements);
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
			return c.json(
				{ error: { code: "DUPLICATE_NAME", message: "A view with this name already exists" } },
				409,
			);
		}
		throw e;
	}

	const view: PersonTableView = {
		id,
		workspaceId: wid,
		name: parsed.data.name,
		columns,
		sort,
		filters,
		isDefault,
		sortOrder,
		createdAt: now,
		updatedAt: now,
	};

	return c.json({ data: view }, 201);
});

tableViewRoutes.put("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();
	const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	applyCliBridges(c, body);

	const parsed = updatePersonTableViewSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: { code: "VALIDATION_ERROR", issues: parsed.error.issues } }, 400);
	}

	const existingRow = await c.env.DB.prepare(
		"SELECT id, workspace_id, name, columns_json, sort_json, filters_json, is_default, sort_order, created_at, updated_at FROM person_table_views WHERE workspace_id = ? AND id = ?",
	)
		.bind(wid, id)
		.first();

	if (!existingRow) {
		return c.json({ error: { code: "NOT_FOUND", message: "Table view not found" } }, 404);
	}

	const existing = mapRow(existingRow as Record<string, unknown>);
	const patch = parsed.data;
	const sortTouched = patch.sort !== undefined;
	const filtersTouched = patch.filters !== undefined;

	const nextColumns =
		patch.columns !== undefined ? (patch.columns as ColumnKey[]) : existing.columns;
	let nextSort: ViewSort = sortTouched ? (patch.sort as ViewSort) : existing.sort;
	let nextFilters: ViewFilter[] = filtersTouched
		? (patch.filters as ViewFilter[])
		: existing.filters;
	const nextName = patch.name ?? existing.name;
	const nextIsDefault = patch.isDefault ?? existing.isDefault;
	const nextSortOrder = patch.sortOrder ?? existing.sortOrder;

	if (patch.isDefault === false && existing.isDefault) {
		return c.json(
			{
				error: {
					code: "CANNOT_CLEAR_DEFAULT",
					message: "Cannot clear default; set another view as default instead",
				},
			},
			400,
		);
	}

	if (patch.columns !== undefined) {
		const stripped = stripRemovedColumnRefs(nextColumns, nextSort, nextFilters);
		nextSort = stripped.sort;
		nextFilters = stripped.filters;
	}

	const structErr = validateColumnsStructure(nextColumns);
	if (structErr) {
		return c.json({ error: { code: "VALIDATION_ERROR", message: structErr } }, 400);
	}

	const defs = await loadFieldDefs(c.env.DB, wid);
	const newFieldErr = validateNewFieldKeys(nextColumns, existing.columns, defs);
	if (newFieldErr) {
		return c.json({ error: { code: "UNKNOWN_FIELD", message: newFieldErr } }, 400);
	}

	if (sortTouched) {
		const sortErr = validateSortAgainstColumns(nextSort, nextColumns, defs);
		if (sortErr) {
			return c.json({ error: { code: "INVALID_SORT", message: sortErr } }, 400);
		}
	}

	if (filtersTouched) {
		for (const f of nextFilters) {
			const ferr = validateFilterAgainstColumn(f, nextColumns, defs);
			if (ferr) {
				return c.json({ error: { code: "INVALID_FILTER", message: ferr } }, 400);
			}
		}
	}

	const now = new Date().toISOString();
	const promoteDefault = nextIsDefault && !existing.isDefault;

	try {
		const statements = [];
		if (promoteDefault) {
			statements.push(
				c.env.DB.prepare(
					"UPDATE person_table_views SET is_default = 0 WHERE workspace_id = ? AND is_default = 1 AND id != ?",
				).bind(wid, id),
			);
		}
		statements.push(
			c.env.DB.prepare(
				"UPDATE person_table_views SET name = ?, columns_json = ?, sort_json = ?, filters_json = ?, is_default = ?, sort_order = ?, updated_at = ? WHERE workspace_id = ? AND id = ?",
			).bind(
				nextName,
				JSON.stringify(nextColumns),
				nextSort === null ? null : JSON.stringify(nextSort),
				JSON.stringify(nextFilters),
				nextIsDefault ? 1 : 0,
				nextSortOrder,
				now,
				wid,
				id,
			),
		);
		await c.env.DB.batch(statements);
	} catch (e: unknown) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
			return c.json(
				{ error: { code: "DUPLICATE_NAME", message: "A view with this name already exists" } },
				409,
			);
		}
		throw e;
	}

	const view: PersonTableView = {
		id,
		workspaceId: wid,
		name: nextName,
		columns: nextColumns,
		sort: nextSort,
		filters: nextFilters,
		isDefault: nextIsDefault,
		sortOrder: nextSortOrder,
		createdAt: existing.createdAt,
		updatedAt: now,
	};

	return c.json({ data: view });
});

tableViewRoutes.delete("/:id", async (c) => {
	const wid = c.req.param("wid") as string;
	const { id } = c.req.param();

	const row = await c.env.DB.prepare(
		"SELECT id, is_default FROM person_table_views WHERE workspace_id = ? AND id = ?",
	)
		.bind(wid, id)
		.first();

	if (!row) {
		return c.json({ error: { code: "NOT_FOUND", message: "Table view not found" } }, 404);
	}

	const countRow = await c.env.DB.prepare(
		"SELECT COUNT(*) as c FROM person_table_views WHERE workspace_id = ?",
	)
		.bind(wid)
		.first();
	const count = Number((countRow as { c: number }).c);

	if (count <= 1) {
		return c.json(
			{
				error: {
					code: "CANNOT_DELETE_LAST_VIEW",
					message: "Cannot delete the last table view in a workspace",
				},
			},
			400,
		);
	}

	if ((row as { is_default: number }).is_default === 1) {
		return c.json(
			{
				error: {
					code: "CANNOT_DELETE_DEFAULT",
					message: "Cannot delete the default view; promote another view first",
				},
			},
			400,
		);
	}

	await c.env.DB.prepare("DELETE FROM person_table_views WHERE workspace_id = ? AND id = ?")
		.bind(wid, id)
		.run();

	return c.json({ data: { deleted: true } });
});

function applyCliBridges(
	c: { req: { query: (k: string) => string | undefined } },
	body: Record<string, unknown>,
): void {
	const columnsCsv = c.req.query("columns");
	if (columnsCsv !== undefined && body.columns === undefined) {
		body.columns = columnsCsv.split(",").filter(Boolean);
	}
	const sortRaw = c.req.query("sort");
	if (sortRaw !== undefined && body.sort === undefined) {
		if (sortRaw === "null") {
			body.sort = null;
		} else {
			try {
				body.sort = JSON.parse(sortRaw);
			} catch {
				body.sort = sortRaw; // let zod fail
			}
		}
	}
	const filtersRaw = c.req.query("filters");
	if (filtersRaw !== undefined && body.filters === undefined) {
		try {
			body.filters = JSON.parse(filtersRaw);
		} catch {
			body.filters = filtersRaw;
		}
	}
}

async function loadFieldDefs(db: D1Database, wid: string): Promise<Map<string, FieldDefMeta>> {
	const rows = await db
		.prepare("SELECT id, field_type, options FROM custom_field_definitions WHERE workspace_id = ?")
		.bind(wid)
		.all();
	const map = new Map<string, FieldDefMeta>();
	for (const row of rows.results) {
		const r = row as Record<string, unknown>;
		const optionsRaw = r.options as string | null;
		map.set(r.id as string, {
			id: r.id as string,
			fieldType: r.field_type as FieldDefMeta["fieldType"],
			options: optionsRaw ? (JSON.parse(optionsRaw) as string[]) : null,
		});
	}
	return map;
}

function mapRow(row: Record<string, unknown>): PersonTableView {
	return {
		id: row.id as string,
		workspaceId: row.workspace_id as string,
		name: row.name as string,
		columns: parseColumnsJson(row.columns_json as string),
		sort: parseSortJson((row.sort_json as string | null) ?? null),
		filters: parseFiltersJson((row.filters_json as string) ?? "[]"),
		isDefault: Boolean(row.is_default),
		sortOrder: row.sort_order as number,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}
