import { BOGO_VERSION } from "@bogo/shared";
import {
	Sidebar as BasaltSidebar,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandPalette,
	SidebarBrand,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarProvider,
	SidebarSearch,
	SidebarToggle,
	SidebarUser,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt/components/tooltip";
import {
	FileText,
	FileType,
	LayoutDashboard,
	ListTree,
	type LucideIcon,
	Network,
	Search,
	Settings,
	Table2,
	Tags,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PersonAvatar } from "@/components/person/PersonAvatar";
import { useUserInfo } from "@/hooks/use-user-info";
import { ACCESS_LOGOUT_URL } from "@/lib/access";

const SIDEBAR_COLLAPSED_KEY = "bogo:sidebar-collapsed";
type SidebarCollapsedPreference = "false" | "true";

interface NavItem {
	title: string;
	icon: LucideIcon;
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

const NAV_GROUPS: { label: string; items: NavItem[]; defaultOpen?: boolean }[] = [
	{ label: "Workspace", items: WORKSPACE_ITEMS, defaultOpen: true },
	{ label: "Settings", items: SETTINGS_ITEMS, defaultOpen: true },
];

function isNavActive(itemPath: string, currentPath: string): boolean {
	return (
		currentPath === itemPath ||
		(itemPath !== "/" && itemPath !== "/settings" && currentPath.startsWith(`${itemPath}/`))
	);
}

function usePersistedSidebarCollapsed(
	key: string,
	defaultValue: SidebarCollapsedPreference,
): [SidebarCollapsedPreference, (value: SidebarCollapsedPreference) => void] {
	const [stored, setStored] = useState<SidebarCollapsedPreference>(() => {
		if (typeof window === "undefined") return defaultValue;
		const value = localStorage.getItem(key);
		return value === "true" || value === "false" ? value : defaultValue;
	});

	const setValue = useCallback(
		(next: SidebarCollapsedPreference) => {
			setStored(next);
			localStorage.setItem(key, next);
		},
		[key],
	);

	return [stored, setValue];
}

export function PersistedSidebarProvider({ children }: { children: ReactNode }) {
	const [stored, setStored] = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_KEY, "false");
	const collapsed = stored === "true";
	const onCollapsedChange = useCallback(
		(next: boolean) => {
			setStored(next ? "true" : "false");
		},
		[setStored],
	);

	return (
		<SidebarProvider collapsed={collapsed} onCollapsedChange={onCollapsedChange} defaultWidth={260}>
			{children}
		</SidebarProvider>
	);
}

interface SidebarProps {
	ariaLabel: string;
	variant?: "desktop" | "mobile";
	onNavigate?: () => void;
	onDismiss?: () => void;
}

function SidebarCommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const navigate = useNavigate();
	const handleSelect = useCallback(
		(path: string) => {
			onOpenChange(false);
			navigate(path);
		},
		[navigate, onOpenChange],
	);

	return (
		<CommandPalette open={open} onOpenChange={onOpenChange}>
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
	);
}

function BogoSidebarBody({
	variant,
	onNavigate,
	onDismiss,
}: {
	variant?: SidebarProps["variant"];
	onNavigate?: () => void;
	onDismiss?: () => void;
}) {
	const { pathname } = useLocation();
	const { collapsed, peek, peeking } = useSidebar();
	const railCollapsed = collapsed && !(peek && peeking);
	const userInfo = useUserInfo();
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

	const avatar = (
		<PersonAvatar name={userInfo.displayName} avatarUrl={userInfo.avatarUrl} size="lg" />
	);

	return (
		<>
			<SidebarHeader>
				<SidebarBrand
					logo={<img src="/logo-24.png" alt="" width={24} height={24} />}
					name="bogo"
					version={`v${BOGO_VERSION}`}
					action={
						variant === "mobile" ? (
							<SidebarToggle
								mode="dismiss"
								dismissLabel="Close navigation"
								{...(onDismiss ? { onDismiss } : {})}
							/>
						) : (
							<SidebarToggle expandLabel="Expand sidebar" collapseLabel="Collapse sidebar" />
						)
					}
				/>
			</SidebarHeader>
			<SidebarNav aria-label="Main navigation">
				{!railCollapsed ? (
					<SidebarSearch
						shortcut="⌘K"
						onClick={(event) => {
							event.preventDefault();
							setSearchOpen(true);
						}}
					>
						Search pages…
					</SidebarSearch>
				) : null}
				{railCollapsed ? (
					<Tooltip delayDuration={0}>
						<TooltipTrigger asChild>
							<SidebarIconItem
								aria-label="Search (⌘K)"
								onClick={(event) => {
									event.preventDefault();
									setSearchOpen(true);
								}}
							>
								<Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
							</SidebarIconItem>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={8}>
							Search (⌘K)
						</TooltipContent>
					</Tooltip>
				) : null}
				{railCollapsed
					? ALL_NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = isNavActive(item.path, pathname);
							return (
								<Tooltip key={item.path} delayDuration={0}>
									<TooltipTrigger asChild>
										<SidebarIconItem
											href={item.path}
											active={active}
											aria-label={item.title}
											onClick={onNavigate}
										>
											<Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
										</SidebarIconItem>
									</TooltipTrigger>
									<TooltipContent side="right" sideOffset={8}>
										{item.title}
									</TooltipContent>
								</Tooltip>
							);
						})
					: NAV_GROUPS.map((group) => (
							<SidebarGroup
								key={group.label}
								label={group.label}
								defaultOpen={group.defaultOpen ?? true}
							>
								{group.items.map((item) => {
									const Icon = item.icon;
									const active = isNavActive(item.path, pathname);
									return (
										<SidebarItem
											key={item.path}
											href={item.path}
											active={active}
											onClick={onNavigate}
										>
											<Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
											<span className="flex-1 truncate text-left">{item.title}</span>
										</SidebarItem>
									);
								})}
							</SidebarGroup>
						))}
			</SidebarNav>
			<SidebarFooter>
				<SidebarUser
					name={userInfo.displayName}
					email={userInfo.email ?? "CF Access"}
					avatar={avatar}
					tooltip={userInfo.displayName}
					signOutHref={ACCESS_LOGOUT_URL}
					signOutLabel="Sign out"
				/>
			</SidebarFooter>
			<SidebarCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
		</>
	);
}

export function Sidebar({ ariaLabel, variant = "desktop", onNavigate, onDismiss }: SidebarProps) {
	return (
		<BasaltSidebar aria-label={ariaLabel} resizable={false}>
			<BogoSidebarBody
				variant={variant}
				{...(onNavigate ? { onNavigate } : {})}
				{...(onDismiss ? { onDismiss } : {})}
			/>
		</BasaltSidebar>
	);
}
