import { BOGO_VERSION } from "@bogo/shared";
import { Activity, Clock, Shield, Users } from "lucide-react";

export function DashboardPage() {
	return (
		<>
			<div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Status</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						Online
					</h3>
					<span className="text-xs font-medium text-green-600">Healthy</span>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Version</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						{BOGO_VERSION}
					</h3>
					<span className="text-xs font-medium text-muted-foreground">Latest</span>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Requests</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						1.2k
					</h3>
					<span className="text-xs font-medium text-green-600">+12%</span>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Uptime</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						99.9%
					</h3>
					<span className="text-xs font-medium text-muted-foreground">30d</span>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2 lg:grid-cols-3">
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Shield className="h-5 w-5 text-primary" />
						</div>
						<h3 className="font-semibold text-foreground">Auth</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						Cloudflare Access protecting all routes. JWT validation active.
					</p>
				</div>
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Activity className="h-5 w-5 text-primary" />
						</div>
						<h3 className="font-semibold text-foreground">Worker</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						Hono on Cloudflare Workers. Static assets served via wrangler v4.
					</p>
				</div>
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Users className="h-5 w-5 text-primary" />
						</div>
						<h3 className="font-semibold text-foreground">Edge</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						Deployed globally on Cloudflare's edge network. Low latency worldwide.
					</p>
				</div>
			</div>

			<div className="mt-4 rounded-xl bg-secondary p-5">
				<div className="flex items-center gap-3 mb-3">
					<Clock className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Recent Activity</h3>
				</div>
				<div className="space-y-3">
					{[
						{ time: "2 min ago", event: "Health check passed" },
						{ time: "5 min ago", event: "API request: GET /api/live" },
						{ time: "12 min ago", event: "Worker deployed v0.1.0" },
						{ time: "1 hour ago", event: "CF Access login" },
					].map((entry) => (
						<div
							key={entry.time}
							className="flex items-center justify-between py-2 border-b border-border last:border-0"
						>
							<span className="text-sm text-foreground">{entry.event}</span>
							<span className="text-xs text-muted-foreground">{entry.time}</span>
						</div>
					))}
				</div>
			</div>
		</>
	);
}
