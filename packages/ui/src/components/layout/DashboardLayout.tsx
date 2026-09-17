import { Button, ContentIsland, Sheet, SheetContent, SheetTitle } from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { Github } from "@/components/icons/Github";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { HeaderTooltip, HexlyLink } from "./header-links";

function resolveAncestors(pathname: string) {
	if (pathname === "/") return [];
	const home = { label: "Home", href: "/" };
	if (/^\/people\/[^/]+$/.test(pathname)) return [home, { label: "Table", href: "/table" }];
	if (/^\/documents\/[^/]+$/.test(pathname))
		return [home, { label: "Documents", href: "/documents" }];
	if (pathname.startsWith("/settings/")) return [home, { label: "Settings", href: "/settings" }];
	return [home];
}

export function DashboardLayout() {
	const [collapsed, setCollapsed] = useState(false);
	const isMobile = useIsMobile();
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();

	const ancestorCrumbs = resolveAncestors(location.pathname);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is intentionally the trigger — the effect closes the mobile drawer on any route change and doesn't read pathname in its body.
	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	return (
		<AppShell>
			<AppSkipLink>Skip to main content</AppSkipLink>
			{!isMobile ? (
				<AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
			) : (
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetContent
						side="left"
						className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0 [&>button]:hidden"
					>
						<SheetTitle className="sr-only">Navigation</SheetTitle>
						<AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
					</SheetContent>
				</Sheet>
			)}

			<AppMain>
				<AppHeader
					leading={
						isMobile ? (
							<HeaderTooltip label="Open navigation">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setMobileOpen(true)}
									aria-label="Open navigation"
									className="h-8 w-8 shrink-0"
								>
									<Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
								</Button>
							</HeaderTooltip>
						) : null
					}
					breadcrumbs={
						isMobile && ancestorCrumbs.length > 1
							? [ancestorCrumbs[ancestorCrumbs.length - 1]]
							: ancestorCrumbs
					}
					actions={
						<>
							<WorkspaceSelector />
							<HeaderTooltip label="GitHub repository">
								<a
									href="https://github.com/nocoo/bogo"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="GitHub repository"
									className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors"
								>
									<Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
								</a>
							</HeaderTooltip>
							<HexlyLink />
							<ThemeToggle />
						</>
					}
				/>
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
					<ContentIsland className="relative">
						<Outlet />
					</ContentIsland>
				</div>
			</AppMain>
		</AppShell>
	);
}
