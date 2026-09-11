import { BOGO_VERSION } from "@bogo/shared";
import {
	Button,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandPalette,
	Sidebar,
	SidebarFooter,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarPartition,
	SidebarSearch,
	SidebarUser,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@nocoo/basalt";
import {
	FileText,
	FileType,
	LayoutDashboard,
	ListTree,
	Network,
	PanelLeft,
	Search,
	Settings,
	Table2,
	Tags,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { useUserInfo } from "@/hooks/use-user-info";

interface NavItem {
	title: string;
	icon: React.ElementType;
	path: string;
}

const WORKSPACE_ITEMS: NavItem[] = [
	{ title: "Overview", icon: LayoutDashboard, path: "/" },
	{ title: "Documents", icon: FileText, path: "/documents" },
	{ title: "People", icon: Network, path: "/people" },
	{ title: "Table", icon: Table2, path: "/table" },
];

const SETTINGS_ITEMS: NavItem[] = [
	{ title: "General", icon: Settings, path: "/settings" },
	{ title: "Doc Types", icon: FileType, path: "/settings/doc-types" },
	{ title: "Fields", icon: ListTree, path: "/settings/fields" },
	{ title: "Tags", icon: Tags, path: "/settings/tags" },
];

const ALL_NAV_ITEMS: NavItem[] = [...WORKSPACE_ITEMS, ...SETTINGS_ITEMS];
const NAV_GROUPS = [
	{ label: "Workspace", items: WORKSPACE_ITEMS },
	{ label: "Settings", items: SETTINGS_ITEMS },
];

function isNavActive(itemPath: string, currentPath: string): boolean {
	return (
		currentPath === itemPath ||
		(itemPath !== "/" && itemPath !== "/settings" && currentPath.startsWith(`${itemPath}/`))
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
	const userInfo = useUserInfo();

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
			<Sidebar collapsed={collapsed}>
				{/* The 68px rail has a fixed 34px icon axis, including during width transitions. */}
				<SidebarHeader className="w-[260px] gap-3 pl-[22px]">
					<Link
						to="/"
						aria-label="Bogo overview"
						className="flex min-w-0 items-center gap-2 rounded-md"
					>
						<img src="/logo-24.png" alt="bogo" width={24} height={24} className="shrink-0" />
						{!collapsed && (
							<>
								<span className="text-lg font-semibold tracking-tight text-basalt-foreground">
									bogo.
								</span>
								<span className="ml-1 rounded-md bg-basalt-secondary px-1.5 py-0.5 text-[10px] font-medium text-basalt-muted-foreground">
									v{BOGO_VERSION}
								</span>
							</>
						)}
					</Link>
					{!collapsed && (
						<Button
							variant="ghost"
							size="icon"
							className="ml-auto h-7 w-7 shrink-0"
							onClick={onToggle}
							aria-label="Collapse sidebar"
						>
							<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
						</Button>
					)}
				</SidebarHeader>

				{collapsed ? (
					<>
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggle}
							aria-label="Expand sidebar"
							className="mb-1 ml-3.5 h-10 w-10 shrink-0"
						>
							<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
						</Button>
						<Tooltip delayDuration={0}>
							<TooltipTrigger asChild>
								<SidebarIconItem
									onClick={() => setSearchOpen(true)}
									aria-label="Search (⌘K)"
									className="mb-2 ml-3.5 shrink-0"
								>
									<Search className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
								</SidebarIconItem>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={8}>
								Search (⌘K)
							</TooltipContent>
						</Tooltip>
					</>
				) : (
					<div className="w-[260px] px-3 pb-2">
						<SidebarSearch className="pl-3.5" onClick={() => setSearchOpen(true)}>
							Search pages…
						</SidebarSearch>
					</div>
				)}

				<SidebarNav
					aria-label="Main navigation"
					className={collapsed ? "w-[68px] gap-3 pt-1" : "w-[260px] gap-3 pt-1"}
				>
					{NAV_GROUPS.map((group) => (
						<div key={group.label} className="space-y-1">
							{!collapsed && (
								<SidebarPartition className="pl-[26px]">{group.label}</SidebarPartition>
							)}
							<div className={collapsed ? "flex flex-col items-center gap-1" : "space-y-0.5 px-3"}>
								{group.items.map((item) =>
									collapsed ? (
										<Tooltip key={item.path} delayDuration={0}>
											<TooltipTrigger asChild>
												<SidebarIconItem
													active={isNavActive(item.path, pathname)}
													aria-label={item.title}
													onClick={() => navigate(item.path)}
												>
													<item.icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
												</SidebarIconItem>
											</TooltipTrigger>
											<TooltipContent side="right" sideOffset={8}>
												{item.title}
											</TooltipContent>
										</Tooltip>
									) : (
										<SidebarItem
											key={item.path}
											className="pl-3.5"
											active={isNavActive(item.path, pathname)}
											onClick={() => navigate(item.path)}
										>
											<item.icon
												className="h-4 w-4 shrink-0"
												aria-hidden="true"
												strokeWidth={1.5}
											/>
											<span className="flex-1 truncate text-left">{item.title}</span>
										</SidebarItem>
									),
								)}
							</div>
						</div>
					))}
				</SidebarNav>

				<SidebarFooter className={collapsed ? "w-[68px] px-4" : "w-[260px]"}>
					<SidebarUser
						name={collapsed ? "" : userInfo.displayName}
						email={collapsed ? undefined : (userInfo.email ?? "CF Access")}
						className={collapsed ? "gap-0" : undefined}
						avatar={
							<PersonAvatar name={userInfo.displayName} avatarUrl={userInfo.avatarUrl} size="lg" />
						}
					/>
				</SidebarFooter>
			</Sidebar>

			<CommandPalette open={searchOpen} onOpenChange={setSearchOpen}>
				<CommandInput placeholder="Search pages..." />
				<CommandList>
					<CommandEmpty>No results found.</CommandEmpty>
					<CommandGroup heading="Navigation">
						{ALL_NAV_ITEMS.map((item) => (
							<CommandItem
								key={item.path}
								value={item.title}
								onSelect={() => handleSelect(item.path)}
							>
								<item.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
								<span>{item.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</CommandPalette>
		</>
	);
}
