import { Button, ContentIsland, Sheet, SheetContent, SheetTitle } from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { Github } from "@/components/icons/Github";
import type { BreadcrumbItem } from "@/components/layout/Breadcrumbs";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { WorkspaceSelector } from "@/components/workspace/WorkspaceSelector";
import { useIsMobile } from "@/hooks/use-mobile";

const SECTION_LABELS: Record<string, string> = {
	"/": "Overview",
	"/documents": "Documents",
	"/people": "People",
	"/table": "Table",
	"/workspaces": "Workspaces",
	"/settings": "Settings",
};

const SETTINGS_CHILD_LABELS: Record<string, string> = {
	"doc-types": "Doc types",
	fields: "Fields",
	tags: "Tags",
};

/**
 * Detail / nested routes: Home › Parent › Current (never raw uuids).
 * In-page PageBackLink always points at the same Parent href.
 */
function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
	if (pathname === "/") {
		return [{ label: "Overview" }];
	}

	// Person editor — opened from Table name click
	if (/^\/people\/[^/]+$/.test(pathname)) {
		return [
			{ label: "Home", href: "/" },
			{ label: "Table", href: "/table" },
			{ label: "Edit person" },
		];
	}

	// Document editor
	if (/^\/documents\/[^/]+$/.test(pathname)) {
		return [
			{ label: "Home", href: "/" },
			{ label: "Documents", href: "/documents" },
			{ label: "Edit document" },
		];
	}

	// Settings children
	const settingsChild = pathname.match(/^\/settings\/([^/]+)$/);
	if (settingsChild) {
		const slug = settingsChild[1] ?? "";
		return [
			{ label: "Home", href: "/" },
			{ label: "Settings", href: "/settings" },
			{ label: SETTINGS_CHILD_LABELS[slug] ?? slug },
		];
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

	const breadcrumbItems = resolveBreadcrumbs(location.pathname);
	// In Basalt AppHeader, breadcrumbs are ancestors, and title is the current page
	const ancestorCrumbs = breadcrumbItems.slice(0, -1);

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
		<AppShell>
			<AppSkipLink>Skip to main content</AppSkipLink>
			{!isMobile ? (
				<AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
			) : (
				<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
					<SheetContent
						side="left"
						className="w-[260px] max-w-[260px] border-0 bg-basalt-background p-0"
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
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setMobileOpen(true)}
								aria-label="Open navigation"
								className="h-8 w-8 shrink-0"
							>
								<Menu className="h-5 w-5" aria-hidden="true" strokeWidth={1.5} />
							</Button>
						) : null
					}
					breadcrumbs={
						isMobile && ancestorCrumbs.length > 1
							? [ancestorCrumbs[ancestorCrumbs.length - 1]]
							: ancestorCrumbs
					}
					title={undefined}
					actions={
						<>
							<WorkspaceSelector />
							<a
								href="https://github.com/nocoo/bogo"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="GitHub repository"
								className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-basalt-muted-foreground hover:text-basalt-foreground hover:bg-basalt-accent transition-colors"
							>
								<Github className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.5} />
							</a>
							<ThemeToggle />
						</>
					}
				/>
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2 md:px-3 md:pb-3">
					<ContentIsland>
						<Outlet />
					</ContentIsland>
				</div>
			</AppMain>
		</AppShell>
	);
}
