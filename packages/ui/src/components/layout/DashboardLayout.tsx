import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { Github } from "@/components/icons/Github";
import type { BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
	"/": "Overview",
	"/documents": "Documents",
	"/people": "People",
	"/workspaces": "Workspaces",
	"/settings": "Settings",
};

function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
	if (pathname === "/") {
		return [{ label: "Overview" }];
	}

	const items: BreadcrumbItem[] = [{ label: "Home", href: "/" }];

	for (const [path, label] of Object.entries(SECTION_LABELS)) {
		if (path === "/") {
			continue;
		}
		if (pathname === path) {
			items.push({ label });
			return items;
		}
		if (pathname.startsWith(`${path}/`)) {
			items.push({ label, href: path });
			const rest = pathname.slice(path.length + 1);
			items.push({ label: rest });
			return items;
		}
	}

	items.push({ label: pathname.slice(1) });
	return items;
}

export function DashboardLayout() {
	const [collapsed, setCollapsed] = useState(false);
	const isMobile = useIsMobile();
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();

	const breadcrumbs = resolveBreadcrumbs(location.pathname);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is intentionally the trigger — the effect closes the mobile drawer on any route change and doesn't read pathname in its body.
	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		if (mobileOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileOpen]);

	return (
		<div className="flex h-screen w-full overflow-hidden bg-background">
			{!isMobile && <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}

			{isMobile && mobileOpen && (
				<>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
					<div
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
						onClick={() => setMobileOpen(false)}
					/>
					<div className="fixed inset-y-0 left-0 z-50 w-[260px]">
						<AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
					</div>
				</>
			)}

			<main className="flex-1 flex flex-col h-full min-w-0 min-h-0">
				<header className="flex h-14 items-center justify-between px-4 md:px-6 shrink-0">
					<div className="flex items-center gap-3">
						{isMobile && (
							<button
								type="button"
								onClick={() => setMobileOpen(true)}
								aria-label="Open navigation"
								className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
							>
								<Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
							</button>
						)}
						<Breadcrumbs items={breadcrumbs} />
					</div>
					<div className="flex items-center gap-1">
						<WorkspaceSelector />
						<a
							href="https://github.com/nocoo/bogo"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub repository"
							className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
						>
							<Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
						</a>
						<ThemeToggle />
					</div>
				</header>
				<div className={cn("flex-1 min-h-0 px-2 pb-2 md:px-3 md:pb-3")}>
					<div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
						<Outlet />
					</div>
				</div>
			</main>
		</div>
	);
}
