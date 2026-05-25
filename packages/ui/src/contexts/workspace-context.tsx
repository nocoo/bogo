import type { Workspace } from "@bogo/shared";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

const STORAGE_KEY = "bogo:workspace-id";

interface WorkspaceContextValue {
	workspaceId: string | null;
	workspace: Workspace | null;
	switchWorkspace: (ws: Workspace | null) => void;
	pendingId: string | null;
	hydrate: (workspaces: Workspace[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readCachedId(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function writeCachedId(id: string | null): void {
	try {
		if (id) {
			localStorage.setItem(STORAGE_KEY, id);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// localStorage unavailable (SSR, private browsing)
	}
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [pendingId] = useState<string | null>(() => readCachedId());

	const switchWorkspace = useCallback((ws: Workspace | null) => {
		setWorkspace(ws);
		writeCachedId(ws?.id ?? null);
	}, []);

	const hydrate = useCallback(
		(workspaces: Workspace[]) => {
			if (workspace) {
				return;
			}
			const cached = readCachedId();
			const match = cached ? workspaces.find((w) => w.id === cached) : undefined;
			const target = match ?? workspaces[0] ?? null;
			if (target) {
				setWorkspace(target);
				writeCachedId(target.id);
			}
		},
		[workspace],
	);

	return (
		<WorkspaceContext
			value={{ workspaceId: workspace?.id ?? null, workspace, switchWorkspace, pendingId, hydrate }}
		>
			{children}
		</WorkspaceContext>
	);
}

export function useWorkspaceContext(): WorkspaceContextValue {
	const ctx = useContext(WorkspaceContext);
	if (!ctx) {
		throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
	}
	return ctx;
}
