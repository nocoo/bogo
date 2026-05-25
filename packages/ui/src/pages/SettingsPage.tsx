import { Bell, Globe, Settings as SettingsIcon, Shield } from "lucide-react";

export function SettingsPage() {
	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div className="rounded-xl bg-secondary p-5">
				<div className="flex items-center gap-3 mb-4">
					<Globe className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Domain</h3>
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Custom Domain</span>
						<span className="text-sm font-mono text-foreground">bogo.hexly.ai</span>
					</div>
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">SSL</span>
						<span className="text-sm text-green-600 font-medium">Active</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-sm text-muted-foreground">DNS Provider</span>
						<span className="text-sm font-mono text-foreground">Cloudflare</span>
					</div>
				</div>
			</div>

			<div className="rounded-xl bg-secondary p-5">
				<div className="flex items-center gap-3 mb-4">
					<Shield className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Authentication</h3>
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Provider</span>
						<span className="text-sm font-mono text-foreground">CF Access</span>
					</div>
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Team</span>
						<span className="text-sm font-mono text-foreground">nocoo</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-sm text-muted-foreground">JWT Validation</span>
						<span className="text-sm text-green-600 font-medium">Enabled</span>
					</div>
				</div>
			</div>

			<div className="rounded-xl bg-secondary p-5">
				<div className="flex items-center gap-3 mb-4">
					<SettingsIcon className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Worker</h3>
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Name</span>
						<span className="text-sm font-mono text-foreground">bogo</span>
					</div>
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Environment</span>
						<span className="text-sm font-mono text-foreground">production</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-sm text-muted-foreground">Assets Mode</span>
						<span className="text-sm font-mono text-foreground">run_worker_first</span>
					</div>
				</div>
			</div>

			<div className="rounded-xl bg-secondary p-5">
				<div className="flex items-center gap-3 mb-4">
					<Bell className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Notifications</h3>
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Deploy Alerts</span>
						<span className="text-sm text-green-600 font-medium">On</span>
					</div>
					<div className="flex items-center justify-between py-2 border-b border-border">
						<span className="text-sm text-muted-foreground">Error Alerts</span>
						<span className="text-sm text-green-600 font-medium">On</span>
					</div>
					<div className="flex items-center justify-between py-2">
						<span className="text-sm text-muted-foreground">Channel</span>
						<span className="text-sm font-mono text-foreground">Email</span>
					</div>
				</div>
			</div>
		</div>
	);
}
