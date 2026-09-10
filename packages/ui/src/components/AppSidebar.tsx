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
	ListTree,
	LogOut,
	Network,
	PanelLeft,
	Search,
	Settings,
	Table2,
	Tags,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { useUserInfo } from "@/hooks/use-user-info";

interface NavItem {
	title: string;
	icon: React.ElementType;
	path: string;
}

const WORKSPACE_ITEMS: NavItem[] = [
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

function isNavActive(itemPath: string, currentPath: string): boolean {
	if (itemPath === "/") {
		return currentPath === "/";
	}
	if (itemPath === "/settings") {
		return currentPath === "/settings";
	}
	return currentPath.startsWith(itemPath);
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
				<SidebarHeader className="px-3">
					<div className="flex w-full items-center justify-between">
						<div className="flex min-w-0 items-center gap-3">
							<img src="/logo-24.png" alt="bogo" className="h-5 w-5 shrink-0" />
							{!collapsed && (
								<>
									<span className="truncate text-base font-semibold text-basalt-foreground md:text-lg">
										bogo.
									</span>
									<span className="shrink-0 rounded-md bg-basalt-secondary px-1.5 py-0.5 text-[10px] leading-none font-medium text-basalt-muted-foreground">
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
					<>
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggle}
							aria-label="Expand sidebar"
							className="mb-1 self-center"
						>
							<PanelLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
						</Button>

						<Tooltip delayDuration={0}>
							<TooltipTrigger asChild>
								<SidebarIconItem
									onClick={() => setSearchOpen(true)}
									aria-label="Search (⌘K)"
									className="mb-2 self-center"
								>
									<Search className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
								</SidebarIconItem>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={8}>
								Search (⌘K)
							</TooltipContent>
						</Tooltip>

						<SidebarNav className="w-full items-center gap-1 pt-1">
							{WORKSPACE_ITEMS.map((item) => (
								<Tooltip key={item.path} delayDuration={0}>
									<TooltipTrigger asChild>
										<SidebarIconItem
											active={isNavActive(item.path, pathname)}
											aria-label={item.title}
											className="self-center"
											onClick={() => navigate(item.path)}
										>
											<item.icon className="h-4 w-4" strokeWidth={1.5} />
										</SidebarIconItem>
									</TooltipTrigger>
									<TooltipContent side="right" sideOffset={8}>
										{item.title}
									</TooltipContent>
								</Tooltip>
							))}
							<div className="my-1.5 h-px w-6 bg-basalt-border" />
							{SETTINGS_ITEMS.map((item) => (
								<Tooltip key={item.path} delayDuration={0}>
									<TooltipTrigger asChild>
										<SidebarIconItem
											active={isNavActive(item.path, pathname)}
											aria-label={item.title}
											className="self-center"
											onClick={() => navigate(item.path)}
										>
											<item.icon className="h-4 w-4" strokeWidth={1.5} />
										</SidebarIconItem>
									</TooltipTrigger>
									<TooltipContent side="right" sideOffset={8}>
										{item.title}
									</TooltipContent>
								</Tooltip>
							))}
						</SidebarNav>

						<SidebarFooter className="flex w-full justify-center px-0">
							<Tooltip delayDuration={0}>
								<TooltipTrigger asChild>
									<span className="inline-flex">
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
						</SidebarFooter>
					</>
				) : (
					<>
						<div className="px-3 pb-1">
							<SidebarSearch onClick={() => setSearchOpen(true)}>Search</SidebarSearch>
						</div>

						<SidebarNav className="pt-1">
							<SidebarPartition>Workspace</SidebarPartition>
							<div className="flex flex-col gap-0.5 px-3">
								{WORKSPACE_ITEMS.map((item) => {
									const isActive = isNavActive(item.path, pathname);
									return (
										<SidebarItem
											key={item.path}
											active={isActive}
											onClick={() => navigate(item.path)}
										>
											<item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
											<span className="flex-1 truncate text-left">{item.title}</span>
										</SidebarItem>
									);
								})}
							</div>

							<SidebarPartition>Settings</SidebarPartition>
							<div className="flex flex-col gap-0.5 px-3">
								{SETTINGS_ITEMS.map((item) => {
									const isActive = isNavActive(item.path, pathname);
									return (
										<SidebarItem
											key={item.path}
											active={isActive}
											onClick={() => navigate(item.path)}
										>
											<item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
											<span className="flex-1 truncate text-left">{item.title}</span>
										</SidebarItem>
									);
								})}
							</div>
						</SidebarNav>

						<SidebarFooter>
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
								action={
									<Button
										variant="ghost"
										size="icon"
										aria-label="Log out"
										className="h-8 w-8 shrink-0 text-basalt-muted-foreground hover:text-basalt-foreground"
									>
										<LogOut className="h-4 w-4" aria-hidden="true" strokeWidth={1.5} />
									</Button>
								}
							/>
						</SidebarFooter>
					</>
				)}
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
