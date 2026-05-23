import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BOGO_VERSION } from "@bogo/shared";
import { Shield } from "lucide-react";

export function HomePage() {
	return (
		<DashboardLayout>
			<div className="space-y-6">
				<div>
					<h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
					<p className="text-sm text-muted-foreground">Welcome to Bogo v{BOGO_VERSION}</p>
				</div>

				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-xl bg-card p-5 border border-border">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<Shield className="h-5 w-5 text-primary" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Status</p>
								<p className="text-lg font-semibold">Online</p>
							</div>
						</div>
					</div>

					<div className="rounded-xl bg-card p-5 border border-border">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<Shield className="h-5 w-5 text-primary" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Version</p>
								<p className="text-lg font-semibold">{BOGO_VERSION}</p>
							</div>
						</div>
					</div>

					<div className="rounded-xl bg-card p-5 border border-border">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<Shield className="h-5 w-5 text-primary" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Auth</p>
								<p className="text-lg font-semibold">CF Access</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}
