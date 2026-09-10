import type { Workspace } from "@bogo/shared";
import { Button } from "@nocoo/basalt";
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
			<Button
				variant="outline"
				size="sm"
				onClick={() => setOpen(!open)}
				className="gap-1.5 text-xs font-medium max-w-[100px] sm:max-w-none px-2 sm:px-2.5 shrink-0"
				aria-label="Select workspace"
			>
				{error ? (
					<AlertCircle className="h-3.5 w-3.5 text-basalt-destructive shrink-0" strokeWidth={1.5} />
				) : (
					<Building2
						className="h-3.5 w-3.5 text-basalt-muted-foreground shrink-0"
						strokeWidth={1.5}
					/>
				)}
				<span className="max-w-[45px] sm:max-w-[120px] truncate">
					{error ? "Error" : isLoading ? "Loading…" : (workspace?.name ?? "Select workspace")}
				</span>
				<ChevronDown
					className={cn(
						"h-3 w-3 text-basalt-muted-foreground transition-transform shrink-0",
						open && "rotate-180",
					)}
					strokeWidth={1.5}
				/>
			</Button>

			<Button
				variant="ghost"
				size="icon"
				onClick={() => navigate("/workspaces")}
				aria-label="Manage workspaces"
				className="hidden sm:flex h-8 w-8 text-basalt-muted-foreground hover:text-basalt-foreground"
			>
				<Settings className="h-[16px] w-[16px]" aria-hidden="true" strokeWidth={1.5} />
			</Button>

			{open && (
				<div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-lg bg-basalt-popover shadow-lg py-1 border border-basalt-border">
					{error && (
						<p className="px-3 py-2 text-xs text-basalt-destructive">Failed to load workspaces</p>
					)}
					{!error && workspaces.length === 0 && !isLoading && (
						<p className="px-3 py-2 text-xs text-basalt-muted-foreground">No workspaces</p>
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
										? "bg-basalt-accent text-basalt-foreground"
										: "text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground",
								)}
							>
								<Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
								<span className="truncate">{ws.name}</span>
							</button>
						))}
					<div className="border-t border-basalt-border mt-1 pt-1">
						<button
							type="button"
							onClick={() => {
								setOpen(false);
								navigate("/workspaces");
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-xs text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground transition-colors"
						>
							<Settings className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
							<span>Manage workspaces</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
