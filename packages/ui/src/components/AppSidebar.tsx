import { cn } from "@/lib/utils";
import { BOGO_VERSION } from "@bogo/shared";
import {
	BarChart3,
	Building2,
	ChevronUp,
	LayoutDashboard,
	LogOut,
	Monitor,
	Mountain,
	PanelLeft,
	ScrollText,
	Search,
	Settings,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

interface NavItem {
	title: string;
	icon: React.ElementType;
	path: string;
}

interface NavGroup {
	label: string;
	items: NavItem[];
	defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
	{
		label: "Overview",
		defaultOpen: true,
		items: [
			{ title: "Dashboard", icon: LayoutDashboard, path: "/" },
			{ title: "Workspaces", icon: Building2, path: "/workspaces" },
			{ title: "Analytics", icon: BarChart3, path: "/analytics" },
			{ title: "Users", icon: Users, path: "/users" },
		],
	},
	{
		label: "System",
		defaultOpen: true,
		items: [
			{ title: "Logs", icon: ScrollText, path: "/logs" },
			{ title: "System", icon: Monitor, path: "/system" },
			{ title: "Settings", icon: Settings, path: "/settings" },
		],
	},
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function NavGroupSection({ group, currentPath }: { group: NavGroup; currentPath: string }) {
	const [open, setOpen] = useState(group.defaultOpen ?? true);
	const navigate = useNavigate();

	return (
		<div className="px-3 mt-2">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center justify-between px-3 py-2.5"
			>
				<span className="text-sm font-normal text-muted-foreground">{group.label}</span>
				<span className="flex h-7 w-7 shrink-0 items-center justify-center">
					<ChevronUp
						className={cn(
							"h-4 w-4 text-muted-foreground transition-transform duration-200",
							!open && "rotate-180",
						)}
						strokeWidth={1.5}
					/>
				</span>
			</button>
			<div
				className="grid overflow-hidden"
				style={{
					gridTemplateRows: open ? "1fr" : "0fr",
					transition: "grid-template-rows 200ms ease-out",
				}}
			>
				<div className="min-h-0 overflow-hidden">
					<div className="flex flex-col gap-0.5">
						{group.items.map((item) => (
							<button
								type="button"
								key={item.path}
								onClick={() => navigate(item.path)}
								className={cn(
									"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors",
									currentPath === item.path
										? "bg-accent text-foreground"
										: "text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
							>
								<item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
								<span className="flex-1 text-left">{item.title}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

function CollapsedNavItem({ item, currentPath }: { item: NavItem; currentPath: string }) {
	const navigate = useNavigate();
	return (
		<button
			type="button"
			onClick={() => navigate(item.path)}
			title={item.title}
			className={cn(
				"relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
				currentPath === item.path
					? "bg-accent text-foreground"
					: "text-muted-foreground hover:bg-accent hover:text-foreground",
			)}
		>
			<item.icon className="h-4 w-4" strokeWidth={1.5} />
		</button>
	);
}

interface AppSidebarProps {
	collapsed: boolean;
	onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [searchOpen, setSearchOpen] = useState(false);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setSearchOpen((prev) => !prev);
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleSelect = useCallback(
		(path: string) => {
			setSearchOpen(false);
			navigate(path);
		},
		[navigate],
	);

	return (
		<>
			<aside
				className={cn(
					"sticky top-0 flex h-screen shrink-0 flex-col bg-background transition-all duration-300 ease-in-out overflow-hidden",
					collapsed ? "w-[68px]" : "w-[260px]",
				)}
			>
				{collapsed ? (
					<div className="flex h-screen w-[68px] flex-col items-center">
						<div className="flex h-14 items-center justify-center">
							<Mountain className="h-5 w-5 text-primary" strokeWidth={1.5} />
						</div>

						<button
							type="button"
							onClick={onToggle}
							aria-label="Expand sidebar"
							className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1"
						>
							<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
						</button>

						<button
							type="button"
							onClick={() => setSearchOpen(true)}
							aria-label="Search (⌘K)"
							className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
						>
							<Search className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
						</button>

						<nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto pt-1">
							{ALL_NAV_ITEMS.map((item) => (
								<CollapsedNavItem key={item.path} item={item} currentPath={pathname} />
							))}
						</nav>

						<div className="py-3 flex justify-center w-full">
							<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
								B
							</div>
						</div>
					</div>
				) : (
					<div className="flex h-screen w-[260px] flex-col">
						<div className="px-3 h-14 flex items-center">
							<div className="flex w-full items-center justify-between px-3">
								<div className="flex items-center gap-3">
									<Mountain className="h-5 w-5 text-primary" strokeWidth={1.5} />
									<span className="text-lg md:text-xl font-semibold text-foreground">bogo.</span>
									<span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground leading-none">
										v{BOGO_VERSION}
									</span>
								</div>
								<button
									type="button"
									onClick={onToggle}
									aria-label="Collapse sidebar"
									className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
								>
									<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
								</button>
							</div>
						</div>

						<div className="px-3 pb-1">
							<button
								type="button"
								onClick={() => setSearchOpen(true)}
								className="flex w-full items-center gap-3 rounded-lg bg-secondary px-3 py-1.5 transition-colors hover:bg-accent cursor-pointer"
							>
								<Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
								<span className="flex-1 text-left text-sm text-muted-foreground">Search</span>
								<span className="flex h-7 w-7 shrink-0 items-center justify-center">
									<kbd className="pointer-events-none hidden rounded-sm border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
										⌘K
									</kbd>
								</span>
							</button>
						</div>

						<nav className="flex-1 overflow-y-auto pt-1">
							{NAV_GROUPS.map((group) => (
								<NavGroupSection key={group.label} group={group} currentPath={pathname} />
							))}
						</nav>

						<div className="px-4 py-3">
							<div className="flex items-center gap-3">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
									B
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-foreground truncate">Bogo Admin</p>
									<p className="text-xs text-muted-foreground truncate">CF Access</p>
								</div>
								<button
									type="button"
									aria-label="Log out"
									className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
								>
									<LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
								</button>
							</div>
						</div>
					</div>
				)}
			</aside>

			{searchOpen && (
				// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss pattern
				<div
					className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-xs"
					onClick={() => setSearchOpen(false)}
				>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation for modal */}
					<div
						className="w-full max-w-md rounded-xl bg-card border border-border shadow-lg p-2"
						onClick={(e) => e.stopPropagation()}
					>
						<input
							ref={(el) => el?.focus()}
							type="text"
							placeholder="Search pages..."
							className="w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									setSearchOpen(false);
								}
							}}
						/>
						<div className="mt-1 border-t border-border pt-1">
							{ALL_NAV_ITEMS.map((item) => (
								<button
									type="button"
									key={item.path}
									onClick={() => handleSelect(item.path)}
									className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
								>
									<item.icon className="h-4 w-4" strokeWidth={1.5} />
									<span>{item.title}</span>
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</>
	);
}
