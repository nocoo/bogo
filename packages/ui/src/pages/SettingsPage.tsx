import { LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Bell, Globe, Settings as SettingsIcon, Shield } from "lucide-react";

export function SettingsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description="System configuration, infrastructure domains, and runtime security."
			/>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<LayerCard>
					<div className="flex items-center gap-3 mb-4">
						<Globe className="h-5 w-5 text-basalt-muted-foreground" />
						<h3 className="font-semibold text-basalt-foreground">Domain</h3>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Custom Domain</span>
							<span className="text-sm font-mono text-basalt-foreground">bogo.hexly.ai</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">SSL</span>
							<span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
								Active
							</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="text-sm text-basalt-muted-foreground">DNS Provider</span>
							<span className="text-sm font-mono text-basalt-foreground">Cloudflare</span>
						</div>
					</div>
				</LayerCard>

				<LayerCard>
					<div className="flex items-center gap-3 mb-4">
						<Shield className="h-5 w-5 text-basalt-muted-foreground" />
						<h3 className="font-semibold text-basalt-foreground">Authentication</h3>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Provider</span>
							<span className="text-sm font-mono text-basalt-foreground">CF Access</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Team</span>
							<span className="text-sm font-mono text-basalt-foreground">nocoo</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="text-sm text-basalt-muted-foreground">JWT Validation</span>
							<span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
								Enabled
							</span>
						</div>
					</div>
				</LayerCard>

				<LayerCard>
					<div className="flex items-center gap-3 mb-4">
						<SettingsIcon className="h-5 w-5 text-basalt-muted-foreground" />
						<h3 className="font-semibold text-basalt-foreground">Worker</h3>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Name</span>
							<span className="text-sm font-mono text-basalt-foreground">bogo</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Environment</span>
							<span className="text-sm font-mono text-basalt-foreground">production</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="text-sm text-basalt-muted-foreground">Assets Mode</span>
							<span className="text-sm font-mono text-basalt-foreground">run_worker_first</span>
						</div>
					</div>
				</LayerCard>

				<LayerCard>
					<div className="flex items-center gap-3 mb-4">
						<Bell className="h-5 w-5 text-basalt-muted-foreground" />
						<h3 className="font-semibold text-basalt-foreground">Notifications</h3>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Deploy Alerts</span>
							<span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">On</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b border-basalt-border">
							<span className="text-sm text-basalt-muted-foreground">Error Alerts</span>
							<span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">On</span>
						</div>
						<div className="flex items-center justify-between py-2">
							<span className="text-sm text-basalt-muted-foreground">Channel</span>
							<span className="text-sm font-mono text-basalt-foreground">Email</span>
						</div>
					</div>
				</LayerCard>
			</div>
		</div>
	);
}
