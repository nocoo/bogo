import type { Workspace } from "@bogo/shared";
import { type ReactNode, createContext, useContext, useState } from "react";

interface WorkspaceContextValue {
	workspaceId: string | null;
	workspace: Workspace | null;
	switchWorkspace: (ws: Workspace | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const [workspace, setWorkspace] = useState<Workspace | null>(null);

	return (
		<WorkspaceContext
			value={{ workspaceId: workspace?.id ?? null, workspace, switchWorkspace: setWorkspace }}
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
