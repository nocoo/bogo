import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen">
			<aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
				<div className="flex items-center gap-2 px-5 py-4 border-b border-sidebar-border">
					<Shield className="h-6 w-6 text-primary" />
					<span className="font-display text-lg font-semibold tracking-tight">Bogo</span>
				</div>
				<nav className="flex-1 px-3 py-4">
					<a
						href="/"
						className={cn(
							"flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
							"bg-sidebar-accent text-sidebar-accent-foreground",
						)}
					>
						Dashboard
					</a>
				</nav>
			</aside>
			<main className="flex-1 p-6">
				<div className="mx-auto max-w-6xl">{children}</div>
			</main>
		</div>
	);
}
