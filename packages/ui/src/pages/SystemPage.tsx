import { Cpu, HardDrive, Thermometer, Wifi } from "lucide-react";

export function SystemPage() {
	const metrics = [
		{ label: "CPU", value: "12%", icon: Cpu, bar: 12 },
		{ label: "Memory", value: "128MB", icon: HardDrive, bar: 45 },
		{ label: "Network I/O", value: "2.4 MB/s", icon: Wifi, bar: 30 },
		{ label: "Worker Temp", value: "Normal", icon: Thermometer, bar: 22 },
	];

	return (
		<>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{metrics.map((m) => (
					<div key={m.label} className="rounded-xl bg-secondary p-5">
						<div className="flex items-center gap-3 mb-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
								<m.icon className="h-5 w-5 text-primary" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">{m.label}</p>
								<p className="text-lg font-semibold text-foreground">{m.value}</p>
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

			<div className="mt-4 rounded-xl bg-secondary p-5">
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
		</>
	);
}
