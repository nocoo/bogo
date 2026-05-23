import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export type DevVarsBackup = { existed: boolean; content: string | null };

export function backupDevVars(path: string): DevVarsBackup {
	if (existsSync(path)) {
		return { existed: true, content: readFileSync(path, "utf-8") };
	}
	return { existed: false, content: null };
}

export function restoreDevVars(path: string, backup: DevVarsBackup): void {
	if (backup.existed && backup.content !== null) {
		writeFileSync(path, backup.content);
	} else if (!backup.existed && existsSync(path)) {
		rmSync(path);
	}
}
