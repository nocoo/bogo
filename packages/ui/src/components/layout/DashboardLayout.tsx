import { Button, ContentIsland, Sheet, SheetContent, SheetTitle } from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { LinkButton } from "@nocoo/basalt/components/button";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { Github } from "@/components/icons/Github";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { HeaderTooltip, HexlyLink } from "./header-links";

type HeaderCrumb = { label: string; href?: string };

function resolveAncestors(pathname: string): HeaderCrumb[] {
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

	const ancestorCrumbs: HeaderCrumb[] = resolveAncestors(location.pathname);
	const breadcrumbs: HeaderCrumb[] =
		isMobile && ancestorCrumbs.length > 1
			? [ancestorCrumbs[ancestorCrumbs.length - 1]]
			: ancestorCrumbs;

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
								>
									<Menu aria-hidden="true" strokeWidth={1.5} />
								</Button>
							</HeaderTooltip>
						) : null
					}
					breadcrumbs={breadcrumbs}
					actions={
						<>
							<WorkspaceSelector />
							<HeaderTooltip label="GitHub repository">
								<LinkButton
									variant="ghost"
									size="icon"
									href="https://github.com/nocoo/bogo"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="GitHub repository"
									className="hidden sm:inline-flex"
								>
									<Github
										className="h-[1.125rem] w-[1.125rem]"
										aria-hidden="true"
										strokeWidth={1.5}
									/>
								</LinkButton>
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
