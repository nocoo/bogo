import type { CustomFieldDefinition, Person } from "@bogo/shared";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValuesVM } from "../../viewmodels/field/use-field-values.js";
import { TagPicker } from "../TagPicker.js";
import { PersonFieldValues } from "../field/PersonFieldValues.js";

function getDescendantIds(persons: Person[], personId: string): Set<string> {
	const ids = new Set<string>();
	const queue = [personId];
	let current = queue.pop();
	while (current !== undefined) {
		for (const p of persons) {
			if (p.managerId === current && !ids.has(p.id)) {
				ids.add(p.id);
				queue.push(p.id);
			}
		}
		current = queue.pop();
	}
	return ids;
}

export function EditPersonPanel({
	person,
	persons,
	onUpdate,
	onMove,
	onRemove,
	onClose,
	isRemoving,
	fieldDefs,
	fieldValuesVm,
}: {
	person: Person;
	persons: Person[];
	onUpdate: (
		id: string,
		fields: { name?: string; title?: string; dottedManagerId?: string | null },
	) => void;
	onMove: (id: string, newManagerId: string | null) => void;
	onRemove: (id: string) => void;
	onClose: () => void;
	isRemoving: boolean;
	fieldDefs?: CustomFieldDefinition[];
	fieldValuesVm?: FieldValuesVM;
}) {
	const [name, setName] = useState(person.name);
	const [title, setTitle] = useState(person.title);
	const [managerId, setManagerId] = useState<string | null>(person.managerId);
	const [dottedManagerId, setDottedManagerId] = useState<string | null>(person.dottedManagerId);

	useEffect(() => {
		setName(person.name);
		setTitle(person.title);
		setManagerId(person.managerId);
		setDottedManagerId(person.dottedManagerId);
	}, [person]);

	const descendantIds = useMemo(() => getDescendantIds(persons, person.id), [persons, person.id]);

	const eligibleManagers = useMemo(
		() => persons.filter((p) => p.id !== person.id && !descendantIds.has(p.id)),
		[persons, person.id, descendantIds],
	);

	const handleManagerChange = useCallback(
		(newManagerId: string) => {
			if (newManagerId && newManagerId !== person.managerId) {
				setManagerId(newManagerId);
				onMove(person.id, newManagerId);
			}
		},
		[person.id, person.managerId, onMove],
	);

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

	const eligibleDottedManagers = persons.filter((p) => p.id !== person.id && p.id !== managerId);

	return (
		<div className="w-72 rounded-xl border border-border bg-secondary p-4 shadow-lg">
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
						className="mt-1 w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground outline-none focus:border-primary"
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

				{!person.isRoot && (
					<div>
						<label htmlFor="edit-manager" className="text-xs text-muted-foreground">
							Manager
						</label>
						<select
							id="edit-manager"
							value={managerId ?? ""}
							onChange={(e) => handleManagerChange(e.target.value)}
							className="mt-1 w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground outline-none focus:border-primary"
						>
							{eligibleManagers.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</div>
				)}

				<div>
					<label htmlFor="edit-dotted" className="text-xs text-muted-foreground">
						Dotted-line manager
					</label>
					<select
						id="edit-dotted"
						value={dottedManagerId ?? ""}
						onChange={(e) => setDottedManagerId(e.target.value || null)}
						className="mt-1 w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground outline-none focus:border-primary"
					>
						<option value="">None</option>
						{eligibleDottedManagers.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</div>

				{fieldDefs && fieldValuesVm && fieldDefs.length > 0 && (
					<PersonFieldValues defs={fieldDefs} vm={fieldValuesVm} />
				)}

				<div>
					<span className="text-xs text-muted-foreground">Tags</span>
					<div className="mt-1">
						<TagPicker scope="person" entityId={person.id} assignedTags={person.tags} />
					</div>
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
