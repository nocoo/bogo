import type { Person } from "@bogo/shared";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function EditPersonPanel({
	person,
	persons,
	onUpdate,
	onRemove,
	onClose,
	isRemoving,
}: {
	person: Person;
	persons: Person[];
	onUpdate: (
		id: string,
		fields: { name?: string; title?: string; dottedManagerId?: string | null },
	) => void;
	onRemove: (id: string) => void;
	onClose: () => void;
	isRemoving: boolean;
}) {
	const [name, setName] = useState(person.name);
	const [title, setTitle] = useState(person.title);
	const [dottedManagerId, setDottedManagerId] = useState<string | null>(person.dottedManagerId);

	useEffect(() => {
		setName(person.name);
		setTitle(person.title);
		setDottedManagerId(person.dottedManagerId);
	}, [person]);

	const handleSave = useCallback(() => {
		const fields: { name?: string; title?: string; dottedManagerId?: string | null } = {};
		if (name.trim() && name.trim() !== person.name) {
			fields.name = name.trim();
		}
		if (title !== person.title) {
			fields.title = title;
		}
		if (dottedManagerId !== person.dottedManagerId) {
			fields.dottedManagerId = dottedManagerId;
		}
		if (Object.keys(fields).length > 0) {
			onUpdate(person.id, fields);
		}
	}, [name, title, dottedManagerId, person, onUpdate]);

	const eligibleDottedManagers = persons.filter(
		(p) => p.id !== person.id && p.id !== person.managerId,
	);

	return (
		<div className="w-72 rounded-xl border border-border bg-card p-4 shadow-lg">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-sm font-semibold text-foreground">Edit Person</h3>
				<button
					type="button"
					onClick={onClose}
					className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close edit panel"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</button>
			</div>

			<div className="space-y-3">
				<div>
					<label htmlFor="edit-name" className="text-xs text-muted-foreground">
						Name
					</label>
					<input
						id="edit-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
					/>
				</div>

				<div>
					<label htmlFor="edit-title" className="text-xs text-muted-foreground">
						Title
					</label>
					<input
						id="edit-title"
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Job title"
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
					/>
				</div>

				<div>
					<label htmlFor="edit-dotted" className="text-xs text-muted-foreground">
						Dotted-line manager
					</label>
					<select
						id="edit-dotted"
						value={dottedManagerId ?? ""}
						onChange={(e) => setDottedManagerId(e.target.value || null)}
						className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
					>
						<option value="">None</option>
						{eligibleDottedManagers.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center justify-between pt-2 border-t border-border">
					<button
						type="button"
						onClick={handleSave}
						className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
					>
						<Save className="h-3 w-3" strokeWidth={2} />
						Save
					</button>

					{!person.isRoot && (
						<button
							type="button"
							onClick={() => onRemove(person.id)}
							disabled={isRemoving}
							className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
							aria-label={`Delete ${person.name}`}
						>
							{isRemoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Trash2 className="h-3 w-3" strokeWidth={2} />
							)}
							Delete
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
