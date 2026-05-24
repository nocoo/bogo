import { BOGO_VERSION } from "@bogo/shared";
import { Activity, Shield, Users } from "lucide-react";

export function OverviewPage() {
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
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Runtime</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						Edge
					</h3>
					<span className="text-xs font-medium text-muted-foreground">CF Workers</span>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Auth</p>
					<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
						Active
					</h3>
					<span className="text-xs font-medium text-green-600">CF Access</span>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2 lg:grid-cols-3">
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Shield className="h-5 w-5 text-primary" />
						</div>
						<h3 className="font-semibold text-foreground">Authentication</h3>
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
						Hono on Cloudflare Workers. D1 database with full CRUD API.
					</p>
				</div>
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Users className="h-5 w-5 text-primary" />
						</div>
						<h3 className="font-semibold text-foreground">Edge Network</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						Deployed globally on Cloudflare's edge. Low latency worldwide.
					</p>
				</div>
			</div>
		</>
	);
}
