import { describe, expect, it, vi } from "vitest";
import { tableViewApi } from "./table-views.js";

function createClient() {
	return {
		request: vi.fn().mockResolvedValue([]),
	};
}

describe("tableViewApi", () => {
	it("lists views", async () => {
		const client = createClient();
		const api = tableViewApi(client as never);
		await api.list("ws-1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/table-views");
	});

	it("gets a view", async () => {
		const client = createClient();
		const api = tableViewApi(client as never);
		await api.get("ws-1", "v1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/table-views/v1");
	});

	it("creates a view", async () => {
		const client = createClient();
		const api = tableViewApi(client as never);
		await api.create("ws-1", { name: "HR", columns: ["builtin:name"] });
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/table-views", {
			method: "POST",
			body: { name: "HR", columns: ["builtin:name"] },
		});
	});

	it("updates a view", async () => {
		const client = createClient();
		const api = tableViewApi(client as never);
		await api.update("ws-1", "v1", { name: "X" });
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/table-views/v1", {
			method: "PUT",
			body: { name: "X" },
		});
	});

	it("deletes a view", async () => {
		const client = createClient();
		const api = tableViewApi(client as never);
		await api.delete("ws-1", "v1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/table-views/v1", {
			method: "DELETE",
		});
	});
});
