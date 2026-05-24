import { Shield, UserCheck, UserX } from "lucide-react";

const MOCK_USERS = [
	{ name: "Zheng Li", email: "zheng@hexly.ai", role: "Admin", active: true },
	{ name: "Alice Chen", email: "alice@hexly.ai", role: "Editor", active: true },
	{ name: "Bob Zhang", email: "bob@hexly.ai", role: "Viewer", active: true },
	{ name: "Carol Wu", email: "carol@hexly.ai", role: "Editor", active: false },
	{ name: "David Liu", email: "david@hexly.ai", role: "Viewer", active: true },
];

export function UsersPage() {
	const activeCount = MOCK_USERS.filter((u) => u.active).length;
	const inactiveCount = MOCK_USERS.length - activeCount;

	return (
		<>
			<div className="grid grid-cols-1 gap-3 md:gap-4 md:grid-cols-3">
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<div className="flex items-center gap-3">
						<Shield className="h-5 w-5 text-primary" />
						<div>
							<p className="text-xs text-muted-foreground">Total Users</p>
							<p className="text-2xl font-semibold text-foreground font-display">
								{MOCK_USERS.length}
							</p>
						</div>
					</div>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<div className="flex items-center gap-3">
						<UserCheck className="h-5 w-5 text-green-600" />
						<div>
							<p className="text-xs text-muted-foreground">Active</p>
							<p className="text-2xl font-semibold text-foreground font-display">{activeCount}</p>
						</div>
					</div>
				</div>
				<div className="rounded-xl bg-secondary p-4 md:p-5">
					<div className="flex items-center gap-3">
						<UserX className="h-5 w-5 text-muted-foreground" />
						<div>
							<p className="text-xs text-muted-foreground">Inactive</p>
							<p className="text-2xl font-semibold text-foreground font-display">{inactiveCount}</p>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-4 rounded-xl bg-secondary p-5">
				<h3 className="font-semibold text-foreground mb-4">User Directory</h3>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border">
								<th className="text-left py-2 pr-4 text-muted-foreground font-medium">Name</th>
								<th className="text-left py-2 pr-4 text-muted-foreground font-medium">Email</th>
								<th className="text-left py-2 pr-4 text-muted-foreground font-medium">Role</th>
								<th className="text-left py-2 text-muted-foreground font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{MOCK_USERS.map((user) => (
								<tr key={user.email} className="border-b border-border last:border-0">
									<td className="py-3 pr-4 text-foreground">{user.name}</td>
									<td className="py-3 pr-4 text-muted-foreground font-mono text-xs">
										{user.email}
									</td>
									<td className="py-3 pr-4">
										<span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
											{user.role}
										</span>
									</td>
									<td className="py-3">
										<span
											className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.active ? "text-green-600" : "text-muted-foreground"}`}
										>
											<span
												className={`h-1.5 w-1.5 rounded-full ${user.active ? "bg-green-600" : "bg-muted-foreground"}`}
											/>
											{user.active ? "Active" : "Inactive"}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
