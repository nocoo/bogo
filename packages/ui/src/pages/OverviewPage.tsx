import { BOGO_VERSION } from "@bogo/shared";
import {
	AlertCircle,
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	CheckCircle,
	Cpu,
	HardDrive,
	Info,
	ScrollText,
	Thermometer,
	TrendingUp,
	Wifi,
} from "lucide-react";

type LogLevel = "info" | "warn" | "error" | "success";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	source: string;
}

const MOCK_LOGS: LogEntry[] = [
	{
		timestamp: "2026-05-24T08:30:01Z",
		level: "info",
		message: "Worker started",
		source: "runtime",
	},
	{
		timestamp: "2026-05-24T08:29:55Z",
		level: "success",
		message: "Health check passed",
		source: "monitor",
	},
	{
		timestamp: "2026-05-24T08:29:12Z",
		level: "info",
		message: "GET /api/live 200 12ms",
		source: "worker",
	},
	{
		timestamp: "2026-05-24T08:28:45Z",
		level: "warn",
		message: "Slow response: 245ms on /api/persons",
		source: "worker",
	},
	{
		timestamp: "2026-05-24T08:27:30Z",
		level: "info",
		message: "CF Access JWT validated",
		source: "auth",
	},
	{
		timestamp: "2026-05-24T08:26:01Z",
		level: "error",
		message: "Rate limit exceeded for 192.168.1.1",
		source: "firewall",
	},
	{
		timestamp: "2026-05-24T08:25:00Z",
		level: "info",
		message: "Static assets served: index.html",
		source: "assets",
	},
	{
		timestamp: "2026-05-24T08:24:30Z",
		level: "success",
		message: "Deploy complete v0.1.0",
		source: "deploy",
	},
];

const LEVEL_CONFIG: Record<LogLevel, { icon: React.ElementType; className: string }> = {
	info: { icon: Info, className: "text-info" },
	warn: { icon: AlertCircle, className: "text-warning" },
	error: { icon: AlertCircle, className: "text-destructive" },
	success: { icon: CheckCircle, className: "text-success" },
};

export function OverviewPage() {
	const systemMetrics = [
		{ label: "CPU", value: "12%", icon: Cpu, bar: 12 },
		{ label: "Memory", value: "128MB", icon: HardDrive, bar: 45 },
		{ label: "Network I/O", value: "2.4 MB/s", icon: Wifi, bar: 30 },
		{ label: "Worker Temp", value: "Normal", icon: Thermometer, bar: 22 },
	];

	return (
		<>
			{/* Status cards */}
			<div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
				<div className="rounded-card bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Status</p>
					<h3 className="text-base font-semibold text-foreground font-display tracking-tight">
						Online
					</h3>
					<span className="text-xs font-medium text-success">Healthy</span>
				</div>
				<div className="rounded-card bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Version</p>
					<h3 className="text-base font-semibold text-foreground font-display tracking-tight">
						{BOGO_VERSION}
					</h3>
					<span className="text-xs font-medium text-muted-foreground">Latest</span>
				</div>
				<div className="rounded-card bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Runtime</p>
					<h3 className="text-base font-semibold text-foreground font-display tracking-tight">
						Edge
					</h3>
					<span className="text-xs font-medium text-muted-foreground">CF Workers</span>
				</div>
				<div className="rounded-card bg-secondary p-4 md:p-5">
					<p className="text-xs md:text-sm text-muted-foreground mb-1">Auth</p>
					<h3 className="text-base font-semibold text-foreground font-display tracking-tight">
						Active
					</h3>
					<span className="text-xs font-medium text-success">CF Access</span>
				</div>
			</div>

			{/* Analytics: traffic stats */}
			<div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 mt-4">
				{[
					{ label: "Total Requests", value: "24.5k", change: "+18%", up: true },
					{ label: "Avg Latency", value: "23ms", change: "-5ms", up: true },
					{ label: "Error Rate", value: "0.02%", change: "+0.01%", up: false },
					{ label: "Cache Hit", value: "94.2%", change: "+2.1%", up: true },
				].map((stat) => (
					<div key={stat.label} className="rounded-card bg-secondary p-4 md:p-5">
						<p className="text-xs md:text-sm text-muted-foreground mb-1">{stat.label}</p>
						<h3 className="text-base font-semibold text-foreground font-display tracking-tight">
							{stat.value}
						</h3>
						<span
							className={`inline-flex items-center gap-1 text-xs font-medium ${stat.up ? "text-success" : "text-destructive"}`}
						>
							{stat.up ? (
								<ArrowUpRight className="h-3 w-3" />
							) : (
								<ArrowDownRight className="h-3 w-3" />
							)}
							{stat.change}
						</span>
					</div>
				))}
			</div>

			{/* Analytics: charts */}
			<div className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-2">
				<div className="rounded-card bg-secondary p-5">
					<div className="flex items-center gap-3 mb-4">
						<BarChart3 className="h-5 w-5 text-muted-foreground" />
						<h3 className="font-semibold text-foreground">Requests by Endpoint</h3>
					</div>
					<div className="space-y-3">
						{[
							{ path: "/api/documents", count: 8420, pct: 85 },
							{ path: "/api/persons", count: 1050, pct: 42 },
							{ path: "/api/workspaces", count: 320, pct: 13 },
						].map((row) => (
							<div key={row.path}>
								<div className="flex justify-between text-sm mb-1">
									<span className="text-foreground font-mono">{row.path}</span>
									<span className="text-muted-foreground">{row.count}</span>
								</div>
								<div className="h-2 rounded-full bg-muted">
									<div className="h-2 rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="rounded-card bg-secondary p-5">
					<div className="flex items-center gap-3 mb-4">
						<TrendingUp className="h-5 w-5 text-muted-foreground" />
						<h3 className="font-semibold text-foreground">Response Times</h3>
					</div>
					<div className="space-y-3">
						{[
							{ label: "p50", value: "12ms" },
							{ label: "p90", value: "45ms" },
							{ label: "p95", value: "78ms" },
							{ label: "p99", value: "156ms" },
						].map((row) => (
							<div
								key={row.label}
								className="flex items-center justify-between py-2 border-b border-border last:border-0"
							>
								<span className="text-sm font-mono text-muted-foreground">{row.label}</span>
								<span className="text-sm font-semibold text-foreground">{row.value}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* System metrics */}
			<div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
				{systemMetrics.map((m) => (
					<div key={m.label} className="rounded-card bg-secondary p-5">
						<div className="flex items-center gap-3 mb-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<m.icon className="h-5 w-5 text-primary" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">{m.label}</p>
								<p className="text-base font-semibold text-foreground">{m.value}</p>
							</div>
						</div>
						<div className="h-2 rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-primary transition-all"
								style={{ width: `${m.bar}%` }}
							/>
						</div>
					</div>
				))}
			</div>

			{/* Runtime information */}
			<div className="mt-4 rounded-card bg-secondary p-5">
				<h3 className="font-semibold text-foreground mb-4">Runtime Information</h3>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{[
						{ key: "Runtime", value: "Cloudflare Workers" },
						{ key: "Region", value: "Global (Edge)" },
						{ key: "Wrangler", value: "v4.94.0" },
						{ key: "Compatibility", value: "2025-03-14" },
						{ key: "Framework", value: "Hono v4" },
						{ key: "Assets", value: "SPA (run_worker_first)" },
					].map((row) => (
						<div
							key={row.key}
							className="flex items-center justify-between py-2 border-b border-border"
						>
							<span className="text-sm text-muted-foreground">{row.key}</span>
							<span className="text-sm font-medium text-foreground font-mono">{row.value}</span>
						</div>
					))}
				</div>
			</div>

			{/* Recent logs */}
			<div className="mt-4 rounded-card bg-secondary p-5">
				<div className="flex items-center gap-3 mb-4">
					<ScrollText className="h-5 w-5 text-muted-foreground" />
					<h3 className="font-semibold text-foreground">Recent Logs</h3>
				</div>
				<div className="space-y-1">
					{MOCK_LOGS.map((log) => {
						const config = LEVEL_CONFIG[log.level];
						return (
							<div
								key={`${log.timestamp}-${log.message}`}
								className="flex items-start gap-3 py-2 border-b border-border last:border-0"
							>
								<config.icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.className}`} />
								<div className="flex-1 min-w-0">
									<p className="text-sm text-foreground truncate">{log.message}</p>
									<div className="flex items-center gap-2 mt-0.5">
										<span className="text-xs text-muted-foreground font-mono">
											{new Date(log.timestamp).toLocaleTimeString()}
										</span>
										<span className="text-xs text-muted-foreground">{log.source}</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}
