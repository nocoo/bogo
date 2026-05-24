import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";

const PAGE_TITLES: Record<string, string> = {
	"/": "Dashboard",
	"/workspaces": "Workspaces",
	"/documents": "Documents",
	"/analytics": "Analytics",
	"/users": "People",
	"/logs": "Logs",
	"/system": "System",
	"/settings": "Settings",
};

function resolveTitle(pathname: string): string {
	if (PAGE_TITLES[pathname]) {
		return PAGE_TITLES[pathname];
	}
	for (const [path, title] of Object.entries(PAGE_TITLES)) {
		if (path !== "/" && pathname.startsWith(`${path}/`)) {
			return title;
		}
	}
	return "Dashboard";
}

export function DashboardLayout() {
	const [collapsed, setCollapsed] = useState(false);
	const isMobile = useIsMobile();
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();

	const title = resolveTitle(location.pathname);

	// biome-ignore lint/correctness/useExhaustiveDependencies: close mobile nav on route change
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
		<div className="flex min-h-screen w-full bg-background">
			{!isMobile && <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />}

			{isMobile && mobileOpen && (
				<>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern */}
					<div
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
						onClick={() => setMobileOpen(false)}
					/>
					<div className="fixed inset-y-0 left-0 z-50 w-[260px]">
						<AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
					</div>
				</>
			)}

			<main className="flex-1 flex flex-col min-h-screen min-w-0">
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
						<h1 className="text-lg md:text-xl font-semibold text-foreground">{title}</h1>
					</div>
				</header>
				<div className={cn("flex-1 px-2 pb-2 md:px-3 md:pb-3")}>
					<div className="h-full rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto">
						<Outlet />
					</div>
				</div>
			</main>
		</div>
	);
}
