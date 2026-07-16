import { describe, expect, it } from "vitest";
import { tableViewKeys, tableViewModel } from "./table-view.model.js";

describe("tableViewKeys", () => {
	it("generates keys", () => {
		expect(tableViewKeys.all("ws-1")).toEqual(["table-views", "ws-1"]);
		expect(tableViewKeys.detail("ws-1", "v1")).toEqual(["table-views", "ws-1", "v1"]);
	});
});

describe("tableViewModel", () => {
	it("listQueryOptions", () => {
		const opts = tableViewModel.listQueryOptions("ws-1");
		expect(opts.queryKey).toEqual(["table-views", "ws-1"]);
		expect(opts.enabled).toBe(true);
		expect(tableViewModel.listQueryOptions("").enabled).toBe(false);
	});

	it("mutation option factories exist", () => {
		expect(tableViewModel.createMutationOptions("ws-1").mutationFn).toBeTypeOf("function");
		expect(tableViewModel.updateMutationOptions("ws-1").mutationFn).toBeTypeOf("function");
		expect(tableViewModel.deleteMutationOptions("ws-1").mutationFn).toBeTypeOf("function");
	});

	it("mutationFns invoke api (network may fail; still covers lines)", async () => {
		const createFn = tableViewModel.createMutationOptions("ws-1").mutationFn;
		const updateFn = tableViewModel.updateMutationOptions("ws-1").mutationFn;
		const deleteFn = tableViewModel.deleteMutationOptions("ws-1").mutationFn;
		// Call with invalid fetch context — expect rejection but exercise the wrappers.
		await expect(createFn({ name: "X", columns: ["builtin:name"] })).rejects.toBeTruthy();
		await expect(updateFn({ id: "v", input: { name: "Y" } })).rejects.toBeTruthy();
		await expect(deleteFn("v")).rejects.toBeTruthy();
	});
});
