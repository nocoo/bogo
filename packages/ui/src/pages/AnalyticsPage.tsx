import { ArrowDownRight, ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";

export function AnalyticsPage() {
	return (
		<>
			<div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
				{[
					{ label: "Total Requests", value: "24.5k", change: "+18%", up: true },
					{ label: "Avg Latency", value: "23ms", change: "-5ms", up: true },
					{ label: "Error Rate", value: "0.02%", change: "+0.01%", up: false },
					{ label: "Cache Hit", value: "94.2%", change: "+2.1%", up: true },
				].map((stat) => (
					<div key={stat.label} className="rounded-xl bg-secondary p-4 md:p-5">
						<p className="text-xs md:text-sm text-muted-foreground mb-1">{stat.label}</p>
						<h3 className="text-xl md:text-2xl font-semibold text-foreground font-display tracking-tight">
							{stat.value}
						</h3>
						<span
							className={`inline-flex items-center gap-1 text-xs font-medium ${stat.up ? "text-green-600" : "text-red-500"}`}
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

			<div className="grid grid-cols-1 gap-4 mt-4 lg:grid-cols-2">
				<div className="rounded-xl bg-secondary p-5">
					<div className="flex items-center gap-3 mb-4">
						<BarChart3 className="h-5 w-5 text-muted-foreground" />
						<h3 className="font-semibold text-foreground">Requests by Endpoint</h3>
					</div>
					<div className="space-y-3">
						{[
							{ path: "/api/live", count: 8420, pct: 85 },
							{ path: "/api/users", count: 1050, pct: 42 },
							{ path: "/api/config", count: 320, pct: 13 },
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

				<div className="rounded-xl bg-secondary p-5">
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
		</>
	);
}
