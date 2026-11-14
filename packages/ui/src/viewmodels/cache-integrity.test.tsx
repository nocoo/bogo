import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../contexts/workspace-context";
import { documentKeys } from "../models/document.model";
import { fieldKeys } from "../models/field.model";
import { tagKeys } from "../models/tag.model";
import { workspaceKeys } from "../models/workspace.model";
import { useDocument } from "./document/use-document";
import { useDocuments } from "./document/use-documents";
import { useFieldDefs } from "./field/use-field-defs";
import { useAllFieldValues, useFieldValues } from "./field/use-field-values";
import { useTags } from "./tag/use-tags";
import { useWorkspaceList } from "./workspace/use-workspace-list";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const workspace = {
	id: "ws-cache",
	ownerId: "owner",
	name: "Cache",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};
const target = {
	id: "target",
	workspaceId: workspace.id,
	name: "Before",
	title: "Before",
	version: 1,
	personId: "target",
	fieldDefId: "target",
	value: "Before",
};
const other = { ...target, id: "other", personId: "other", fieldDefId: "other" };
const response = (data: unknown) => new Response(JSON.stringify({ data }));

function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
	});
	client.setQueryData(workspaceKeys.all, [workspace, { ...workspace, id: "other" }]);
	client.setQueryData(tagKeys.withCounts(workspace.id, "document"), [target, other]);
	client.setQueryData(fieldKeys.defs(workspace.id), [target, other]);
	client.setQueryData(fieldKeys.values(workspace.id, "target"), [target, other]);
	client.setQueryData(fieldKeys.allValues(workspace.id), [
		target,
		{ ...target, id: "second", fieldDefId: "second" },
		other,
	]);
	client.setQueryData(documentKeys.all(workspace.id), [target, other]);
	client.setQueryData(documentKeys.detail(workspace.id, "target"), target);
	client.setQueryData(documentKeys.versions(workspace.id, "target"), []);
	client.setQueryData(documentKeys.persons(workspace.id, "target"), []);
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			<WorkspaceProvider>{children}</WorkspaceProvider>
		</QueryClientProvider>
	);
	const hook = renderHook(
		() => ({
			context: useWorkspaceContext(),
			tags: useTags("document"),
			defs: useFieldDefs(),
			fields: useFieldValues("target"),
			allFields: useAllFieldValues(),
			documents: useDocuments(),
			document: useDocument("target"),
			workspaces: useWorkspaceList(),
		}),
		{ wrapper },
	);
	act(() => hook.result.current.context.switchWorkspace(workspace));
	return { ...hook, client };
}

describe("workspace cache continuity", () => {
	it("returns an empty field value before workspace data exists", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => response([])),
		);
		const { result } = mount();
		act(() => result.current.context.switchWorkspace(null));
		expect(result.current.fields.getValueFor("missing")).toBe("");
	});

	it.each(["defs", "documents", "workspaces"] as const)(
		"creates a %s row after list eviction",
		async (kind) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async (_url, init) =>
					response(
						init?.method === "POST"
							? { ...target, title: "New", name: "New" }
							: [{ ...target, title: "New", name: "New" }],
					),
				),
			);
			const { result, client } = mount();
			const key =
				kind === "defs"
					? fieldKeys.defs(workspace.id)
					: kind === "documents"
						? documentKeys.all(workspace.id)
						: workspaceKeys.all;
			act(() => client.removeQueries({ queryKey: key, exact: true }));
			act(() => {
				if (kind === "defs")
					result.current.defs.create({ name: "New", fieldType: "text", required: false });
				else if (kind === "documents")
					result.current.documents.create({ title: "New", content: "", personIds: [] });
				else result.current.workspaces.create("New");
			});
			await waitFor(() => expect(toast.success).toHaveBeenCalled());
			expect(client.getQueryData(key)).toEqual([
				expect.objectContaining({ id: "target", name: "New" }),
			]);
		},
	);
	it("clears selection when the selected list was evicted", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => response([])),
		);
		const { result, client } = mount();
		act(() => client.removeQueries({ queryKey: workspaceKeys.all, exact: true }));
		act(() => result.current.workspaces.select("missing"));
		expect(result.current.context.workspaceId).toBeNull();
	});

	it.each(["tags", "documents"] as const)(
		"does not resurrect evicted %s rows when an in-flight save returns",
		async (kind) => {
			let release: (response: Response) => void = () => {};
			vi.stubGlobal(
				"fetch",
				vi.fn((_url, init) =>
					init?.method === "PUT"
						? new Promise<Response>((done) => {
								release = done;
							})
						: Promise.resolve(response([])),
				),
			);
			const { result, client } = mount();
			act(() => {
				if (kind === "tags") result.current.tags.update("target", { name: "After" });
				else result.current.documents.update("target", { title: "After" });
			});
			await waitFor(() =>
				expect(
					kind === "tags" ? result.current.tags.isUpdating : result.current.documents.isUpdating,
				).toBe(true),
			);
			const key =
				kind === "tags"
					? tagKeys.withCounts(workspace.id, "document")
					: documentKeys.all(workspace.id);
			act(() => client.removeQueries({ queryKey: key, exact: true }));
			act(() => release(response({ ...target, version: 2 })));
			await waitFor(() => expect(toast.success).toHaveBeenCalled());
			expect(client.getQueryData(key)).toEqual([]);
		},
	);

	it.each(["add", "remove"] as const)(
		"rolls back a rejected person %s with an evicted association cache",
		async (operation) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async (_url, init) =>
					init?.method && init.method !== "GET"
						? new Response(
								JSON.stringify({ error: { code: "REJECTED", message: "Association rejected" } }),
								{ status: 400 },
							)
						: response([]),
				),
			);
			const { result, client } = mount();
			const key = documentKeys.persons(workspace.id, "target");
			act(() => client.removeQueries({ queryKey: key, exact: true }));
			act(() => {
				if (operation === "add") result.current.document.addPerson({ personId: "person" });
				else result.current.document.removePerson("person");
			});
			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Association rejected"));
			expect(client.getQueryData(key)).toEqual([]);
		},
	);
	it("merges returned tag identity while retaining unrelated tags", async () => {
		let release: (response: Response) => void = () => {};
		vi.stubGlobal(
			"fetch",
			vi.fn((_url, init) =>
				init?.method === "PUT"
					? new Promise<Response>((done) => {
							release = done;
						})
					: Promise.resolve(response([{ ...target, name: "Saved", color: "blue" }, other])),
			),
		);
		const { result } = mount();
		act(() => result.current.tags.update("target", { name: "Renamed" }));
		await waitFor(() => expect(result.current.tags.tags[0].name).toBe("Renamed"));
		expect(result.current.tags.tags[1].name).toBe("Before");
		act(() => release(response({ ...target, name: "Saved", color: "blue" })));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag saved"));
	});

	it("updates one document version without changing the other row", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url, init) =>
				response(
					init?.method === "PUT"
						? { version: 2 }
						: [{ ...target, title: "After", version: 2 }, other],
				),
			),
		);
		const { result, client } = mount();
		act(() => result.current.documents.update("target", { title: "After" }));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Document saved"));
		const cached = client.getQueryData<(typeof target)[]>(documentKeys.all(workspace.id));
		expect(cached?.find((row) => row.id === "target")?.version).toBe(2);
		expect(cached?.find((row) => row.id === "other")).toEqual(other);
	});

	it("retains other field values and groups several values per person", async () => {
		let release: (response: Response) => void = () => {};
		vi.stubGlobal(
			"fetch",
			vi.fn((_url, init) =>
				init?.method === "PUT"
					? new Promise<Response>((done) => {
							release = done;
						})
					: Promise.resolve(response([target, other])),
			),
		);
		const { result } = mount();
		expect(result.current.allFields.valuesByPerson.get("target")).toHaveLength(2);
		expect(result.current.allFields.valuesByPerson.get("other")).toEqual([other]);
		act(() => result.current.fields.setValue("target", "After"));
		await waitFor(() => expect(result.current.fields.getValueFor("target")).toBe("After"));
		expect(result.current.fields.getValueFor("other")).toBe("Before");
		act(() => release(response({ value: "After" })));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Field saved"));
	});

	it.each([
		"tags-update",
		"tags-delete",
		"defs-update",
		"defs-delete",
		"docs-update",
		"docs-delete",
		"workspace-rename",
		"workspace-delete",
		"field-value",
	] as const)("handles %s after its list cache was evicted", async (operation) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url, init) =>
				init?.method && init.method !== "GET"
					? response(
							String(_url).includes("/workspaces/")
								? { ...workspace, name: "After" }
								: { ...target, version: 2 },
						)
					: response([]),
			),
		);
		const { result, client } = mount();
		const key = operation.startsWith("tags")
			? tagKeys.withCounts(workspace.id, "document")
			: operation.startsWith("defs")
				? fieldKeys.defs(workspace.id)
				: operation.startsWith("docs")
					? documentKeys.all(workspace.id)
					: operation.startsWith("workspace")
						? workspaceKeys.all
						: fieldKeys.values(workspace.id, "target");
		act(() => client.removeQueries({ queryKey: key, exact: true }));
		act(() => {
			switch (operation) {
				case "tags-update":
					result.current.tags.update("target", { name: "After" });
					break;
				case "tags-delete":
					result.current.tags.remove("target");
					break;
				case "defs-update":
					result.current.defs.update("target", { name: "After" });
					break;
				case "defs-delete":
					result.current.defs.remove("target");
					break;
				case "docs-update":
					result.current.documents.update("target", { title: "After" });
					break;
				case "docs-delete":
					result.current.documents.remove("target");
					break;
				case "workspace-rename":
					result.current.workspaces.rename(workspace.id, "After");
					break;
				case "workspace-delete":
					result.current.workspaces.remove("target");
					break;
				case "field-value":
					result.current.fields.setValue("target", "After");
					break;
			}
		});
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("does not invent a document detail after eviction or a failed save", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url, init) =>
				init?.method === "PUT"
					? new Response(
							JSON.stringify({ error: { code: "REJECTED", message: "Save rejected" } }),
							{ status: 400 },
						)
					: response(null),
			),
		);
		const { result, client } = mount();
		act(() =>
			client.removeQueries({ queryKey: documentKeys.detail(workspace.id, "target"), exact: true }),
		);
		act(() => result.current.document.update({ title: "After" }));
		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Save rejected"));
		expect(client.getQueryData(documentKeys.detail(workspace.id, "target"))).toBeFalsy();
	});
});
