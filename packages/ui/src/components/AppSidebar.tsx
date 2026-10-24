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
	SidebarGroup,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
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
			<Sidebar collapsed={collapsed} aria-label="Main navigation">
				<SidebarHeader>
					<div
						className={
							collapsed
								? "flex w-full justify-center"
								: "flex w-full min-w-0 items-center justify-between"
						}
					>
						<div
							className={
								collapsed ? "flex items-center" : "flex min-w-0 items-center gap-basalt-space-lg"
							}
						>
							<Link to="/" aria-label="Bogo overview" className="flex shrink-0 items-center">
								<img src="/logo-24.png" alt="bogo" width={24} height={24} className="shrink-0" />
							</Link>
							{!collapsed && (
								<>
									<span className="truncate text-lg font-semibold text-basalt-foreground md:text-xl">
										bogo.
									</span>
									<span className="shrink-0 rounded-md bg-basalt-secondary px-basalt-space-md py-basalt-space-xs font-mono text-[10px] leading-none font-medium text-basalt-muted-foreground">
										v{BOGO_VERSION}
									</span>
								</>
							)}
						</div>
						{!collapsed && (
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0"
								onClick={onToggle}
								aria-label="Collapse sidebar"
							>
								<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
							</Button>
						)}
					</div>
				</SidebarHeader>

				{collapsed ? (
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggle}
						aria-label="Expand sidebar"
						className="mb-basalt-space-sm self-center"
					>
						<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
					</Button>
				) : (
					<div className="px-basalt-nav-inset">
						<SidebarSearch onClick={() => setSearchOpen(true)}>Search pages…</SidebarSearch>
					</div>
				)}

				<SidebarNav aria-label="Main navigation">
					{collapsed ? (
						<>
							<Tooltip delayDuration={0}>
								<TooltipTrigger asChild>
									<SidebarIconItem onClick={() => setSearchOpen(true)} aria-label="Search (⌘K)">
										<Search className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
									</SidebarIconItem>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									Search (⌘K)
								</TooltipContent>
							</Tooltip>
							{ALL_NAV_ITEMS.map((item) => (
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
							))}
						</>
					) : (
						NAV_GROUPS.map((group) => (
							<SidebarGroup key={group.label} label={group.label}>
								{group.items.map((item) => (
									<SidebarItem
										key={item.path}
										active={isNavActive(item.path, pathname)}
										onClick={() => navigate(item.path)}
									>
										<item.icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={1.5} />
										<span className="flex-1 truncate text-left">{item.title}</span>
									</SidebarItem>
								))}
							</SidebarGroup>
						))
					)}
				</SidebarNav>

				<SidebarFooter>
					{collapsed ? (
						<Tooltip delayDuration={0}>
							<TooltipTrigger asChild>
								<span className="inline-flex self-center">
									<PersonAvatar
										name={userInfo.displayName}
										avatarUrl={userInfo.avatarUrl}
										size="lg"
									/>
								</span>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={8}>
								{userInfo.displayName}
							</TooltipContent>
						</Tooltip>
					) : (
						<SidebarUser
							name={userInfo.displayName}
							email={userInfo.email ?? "CF Access"}
							avatar={
								<PersonAvatar
									name={userInfo.displayName}
									avatarUrl={userInfo.avatarUrl}
									size="lg"
								/>
							}
						/>
					)}
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
