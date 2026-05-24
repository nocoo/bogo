import { AlertCircle, CheckCircle, Info, ScrollText } from "lucide-react";

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
		message: "Slow response: 245ms on /api/users",
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
	info: { icon: Info, className: "text-blue-500" },
	warn: { icon: AlertCircle, className: "text-yellow-500" },
	error: { icon: AlertCircle, className: "text-red-500" },
	success: { icon: CheckCircle, className: "text-green-500" },
};

export function LogsPage() {
	return (
		<>
			<div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
				{[
					{ label: "Total", value: "2.4k", level: "info" as const },
					{ label: "Errors", value: "3", level: "error" as const },
					{ label: "Warnings", value: "12", level: "warn" as const },
					{ label: "Success", value: "2.3k", level: "success" as const },
				].map((stat) => {
					const config = LEVEL_CONFIG[stat.level];
					return (
						<div key={stat.label} className="rounded-xl bg-secondary p-4 md:p-5">
							<div className="flex items-center gap-2">
								<config.icon className={`h-4 w-4 ${config.className}`} />
								<p className="text-xs text-muted-foreground">{stat.label}</p>
							</div>
							<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight mt-1">
								{stat.value}
							</h3>
						</div>
					);
				})}
			</div>

			<div className="mt-4 rounded-xl bg-secondary p-5">
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
