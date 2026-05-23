import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backupDevVars, restoreDevVars } from "./dev-vars";

describe("dev-vars backup/restore", () => {
	let tempFile: string;

	beforeEach(() => {
		tempFile = join(tmpdir(), `dev-vars-test-${Date.now()}.tmp`);
	});

	afterEach(() => {
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}
	});

	it("backup returns existed=false when file does not exist", () => {
		const backup = backupDevVars(tempFile);
		expect(backup.existed).toBe(false);
		expect(backup.content).toBeNull();
	});

	it("backup captures file content when file exists", () => {
		writeFileSync(tempFile, "KEY=value\n");
		const backup = backupDevVars(tempFile);
		expect(backup.existed).toBe(true);
		expect(backup.content).toBe("KEY=value\n");
	});

	it("restore recreates original file after overwrite", () => {
		writeFileSync(tempFile, "ORIGINAL=content\n");
		const backup = backupDevVars(tempFile);

		writeFileSync(tempFile, "OVERWRITTEN=e2e\n");
		restoreDevVars(tempFile, backup);

		expect(readFileSync(tempFile, "utf-8")).toBe("ORIGINAL=content\n");
	});

	it("restore removes file if it did not exist before", () => {
		const backup = backupDevVars(tempFile);
		writeFileSync(tempFile, "TEMP=data\n");

		restoreDevVars(tempFile, backup);
		expect(existsSync(tempFile)).toBe(false);
	});

	it("restore is a no-op if file did not exist and is already gone", () => {
		const backup = backupDevVars(tempFile);
		restoreDevVars(tempFile, backup);
		expect(existsSync(tempFile)).toBe(false);
	});
});
