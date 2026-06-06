import type { Workspace } from "@bogo/shared";
import { AlertCircle, Building2, ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useWorkspaceList } from "../../viewmodels/workspace/use-workspace-list.js";

export function WorkspaceSelector() {
	const { workspace, switchWorkspace, hydrate } = useWorkspaceContext();
	const { workspaces, isLoading, error } = useWorkspaceList();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isLoading && workspaces.length > 0) {
			hydrate(workspaces);
		}
	}, [isLoading, workspaces, hydrate]);

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	const handleSelect = (ws: Workspace) => {
		switchWorkspace(ws);
		setOpen(false);
	};

	return (
		<div ref={ref} className="relative flex items-center gap-1">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={cn(
					"inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
					"border border-border bg-secondary hover:bg-accent text-foreground",
				)}
				aria-label="Select workspace"
			>
				{error ? (
					<AlertCircle className="h-3.5 w-3.5 text-red-500" strokeWidth={1.5} />
				) : (
					<Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
				)}
				<span className="max-w-[120px] truncate">
					{error ? "Error" : isLoading ? "Loading…" : (workspace?.name ?? "Select workspace")}
				</span>
				<ChevronDown
					className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")}
					strokeWidth={1.5}
				/>
			</button>

			<button
				type="button"
				onClick={() => navigate("/workspaces")}
				aria-label="Manage workspaces"
				className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
			>
				<Settings className="h-[16px] w-[16px]" aria-hidden="true" strokeWidth={1.5} />
			</button>

			{open && (
				<div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-lg border border-border bg-secondary shadow-lg py-1">
					{error && <p className="px-3 py-2 text-xs text-red-500">Failed to load workspaces</p>}
					{!error && workspaces.length === 0 && !isLoading && (
						<p className="px-3 py-2 text-xs text-muted-foreground">No workspaces</p>
					)}
					{!error &&
						workspaces.map((ws) => (
							<button
								key={ws.id}
								type="button"
								onClick={() => handleSelect(ws)}
								className={cn(
									"flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
									ws.id === workspace?.id
										? "bg-accent text-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
							>
								<Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
								<span className="truncate">{ws.name}</span>
							</button>
						))}
				</div>
			)}
		</div>
	);
}
