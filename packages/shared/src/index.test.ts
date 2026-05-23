import { describe, expect, it } from "vitest";
import { BOGO_VERSION } from "./index";

describe("shared", () => {
	it("exports BOGO_VERSION", () => {
		expect(BOGO_VERSION).toBe("0.1.0");
	});
});
