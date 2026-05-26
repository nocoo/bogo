import { describe, expect, it } from "vitest";
import { tagKeys, tagModel } from "./tag.model.js";

describe("tagKeys", () => {
	it("generates all key", () => {
		expect(tagKeys.all("ws-1")).toEqual(["tags", "ws-1"]);
	});

	it("generates byScope key", () => {
		expect(tagKeys.byScope("ws-1", "document")).toEqual(["tags", "ws-1", "document"]);
	});

	it("generates withCounts key", () => {
		expect(tagKeys.withCounts("ws-1", "person")).toEqual(["tags", "ws-1", "person", "counts"]);
	});

	it("generates stats key", () => {
		expect(tagKeys.stats("ws-1", "document")).toEqual(["tags", "ws-1", "document", "stats"]);
	});
});

describe("tagModel", () => {
	it("queryOptions uses withCounts key when includeCounts true", () => {
		const opts = tagModel.queryOptions("ws-1", "document", true);
		expect(opts.queryKey).toEqual(["tags", "ws-1", "document", "counts"]);
		expect(opts.enabled).toBe(true);
	});

	it("queryOptions uses byScope key when includeCounts false", () => {
		const opts = tagModel.queryOptions("ws-1", "person", false);
		expect(opts.queryKey).toEqual(["tags", "ws-1", "person"]);
		expect(opts.enabled).toBe(true);
	});

	it("queryOptions disables query when wid is empty", () => {
		const opts = tagModel.queryOptions("", "document", true);
		expect(opts.enabled).toBe(false);
	});

	it("statsQueryOptions sets correct key and enabled", () => {
		const opts = tagModel.statsQueryOptions("ws-1", "document");
		expect(opts.queryKey).toEqual(["tags", "ws-1", "document", "stats"]);
		expect(opts.enabled).toBe(true);
	});

	it("statsQueryOptions disables when wid is empty", () => {
		const opts = tagModel.statsQueryOptions("", "person");
		expect(opts.enabled).toBe(false);
	});

	it("createMutationOptions has mutationFn", () => {
		const opts = tagModel.createMutationOptions("ws-1");
		expect(opts.mutationFn).toBeTypeOf("function");
	});

	it("updateMutationOptions has mutationFn", () => {
		const opts = tagModel.updateMutationOptions("ws-1");
		expect(opts.mutationFn).toBeTypeOf("function");
	});

	it("deleteMutationOptions has mutationFn", () => {
		const opts = tagModel.deleteMutationOptions("ws-1");
		expect(opts.mutationFn).toBeTypeOf("function");
	});

	it("assignMutationOptions has mutationFn", () => {
		const opts = tagModel.assignMutationOptions("ws-1");
		expect(opts.mutationFn).toBeTypeOf("function");
	});

	it("unassignMutationOptions has mutationFn", () => {
		const opts = tagModel.unassignMutationOptions("ws-1");
		expect(opts.mutationFn).toBeTypeOf("function");
	});
});
