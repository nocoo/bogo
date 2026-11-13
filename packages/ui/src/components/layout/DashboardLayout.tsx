import { ContentIsland, SidebarDrawer } from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { useEffect, useId, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileNavProvider, useMobileNav } from "./mobile-nav-context";
import { PersistedSidebarProvider, Sidebar } from "./sidebar";

type HeaderCrumb = { label: string; href?: string };

function resolvePageBreadcrumbs(pathname: string): HeaderCrumb[] {
	if (pathname === "/") return [];
	if (/^\/people\/[^/]+$/.test(pathname)) return [{ label: "Table", href: "/table" }];
	if (/^\/documents\/[^/]+$/.test(pathname)) return [{ label: "Documents", href: "/documents" }];
	if (pathname.startsWith("/settings/")) return [{ label: "Settings", href: "/settings" }];
	return [];
}

function DashboardLayoutInner() {
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useMobileNav();
	const location = useLocation();
	const menuButton = useRef<HTMLButtonElement>(null);
	const drawerId = useId();

	useEffect(() => {
		void location.pathname;
		setMobileOpen(false);
	}, [location.pathname, setMobileOpen]);

	const allBreadcrumbs: HeaderCrumb[] = [
		{ label: "Home", href: "/" },
		...resolvePageBreadcrumbs(location.pathname),
	];
	const breadcrumbs =
		isMobile && allBreadcrumbs.length > 1
			? [allBreadcrumbs[allBreadcrumbs.length - 1]]
			: allBreadcrumbs;

	return (
		<AppShell>
			<AppSkipLink href="#main-content">Skip to main content</AppSkipLink>

			{!isMobile && (
				<PersistedSidebarProvider>
					<Sidebar ariaLabel="Main navigation" />
				</PersistedSidebarProvider>
			)}

			{isMobile && (
				<SidebarDrawer
					id={drawerId}
					open={mobileOpen}
					onOpenChange={setMobileOpen}
					returnFocusRef={menuButton}
					title="Navigation"
					description="Browse Bogo dashboard pages"
				>
					<Sidebar
						ariaLabel="Navigation"
						variant="mobile"
						onNavigate={() => setMobileOpen(false)}
						onDismiss={() => setMobileOpen(false)}
					/>
				</SidebarDrawer>
			)}

			<AppMain>
				<AppHeader
					leading={
						isMobile ? (
							<AppHeaderMenuButton
								ref={menuButton}
								label="Open navigation menu"
								aria-expanded={mobileOpen}
								aria-haspopup="dialog"
								aria-controls={drawerId}
								onClick={() => setMobileOpen(true)}
							/>
						) : null
					}
					breadcrumbs={breadcrumbs}
					breadcrumbsLabel="Breadcrumb"
					actions={
						<>
							<WorkspaceSelector />
							<ProjectLinks github="nocoo/bogo" hexly="bogo" name="Bogo" />
							<ThemeToggle aria-label="Toggle theme" />
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

export function DashboardLayout() {
	return (
		<MobileNavProvider>
			<DashboardLayoutInner />
		</MobileNavProvider>
	);
}
