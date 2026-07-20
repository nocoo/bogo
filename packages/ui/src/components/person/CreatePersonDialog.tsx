import type { Person } from "@bogo/shared";
import { Loader2, Plus, UserX, X } from "lucide-react";
import { useCallback, useState } from "react";

export function CreatePersonDialog({
	persons,
	onSubmit,
	onClose,
	isCreating,
}: {
	persons: Person[];
	onSubmit: (name: string, managerId: string) => void;
	onClose: () => void;
	isCreating: boolean;
}) {
	const root = persons.find((p) => p.isRoot);
	const [name, setName] = useState("");
	const [managerId, setManagerId] = useState<string>(root?.id ?? persons[0]?.id ?? "");

	const handleSubmit = useCallback(() => {
		const trimmed = name.trim();
		if (trimmed && managerId) {
			onSubmit(trimmed, managerId);
		}
	}, [name, managerId, onSubmit]);

	return (
		<div className="rounded-xl bg-card p-4 shadow-lg w-80">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-foreground">Add Person</h3>
				<button
					type="button"
					onClick={onClose}
					className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close create dialog"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</button>
			</div>

			<div className="space-y-3">
				<div>
					<label htmlFor="person-name" className="text-xs text-muted-foreground">
						Name
					</label>
					<input
						id="person-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleSubmit();
							}
							if (e.key === "Escape") {
								onClose();
							}
						}}
						placeholder="Person name"
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
						// biome-ignore lint/a11y/noAutofocus: intentional focus on form activation
						autoFocus={true}
					/>
				</div>

				<div>
					<label htmlFor="person-manager" className="text-xs text-muted-foreground">
						Reports to
					</label>
					<select
						id="person-manager"
						value={managerId}
						onChange={(e) => setManagerId(e.target.value)}
						className="mt-1 w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground outline-none focus:border-primary"
					>
						{persons.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2 pt-1">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!(name.trim() && managerId) || isCreating}
						className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
					>
						{isCreating ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Plus className="h-3 w-3" strokeWidth={2} />
						)}
						{isCreating ? "Creating..." : "Create"}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

export function EmptyPersonState() {
	return (
		<div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
			<UserX className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
			<p className="mt-4 text-sm text-muted-foreground">No people in this workspace yet</p>
			<p className="mt-1 text-xs text-muted-foreground">
				The workspace root person is created automatically
			</p>
		</div>
	);
}
