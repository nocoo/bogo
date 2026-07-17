import type { CustomFieldDefinition, Person, UpdatePersonInput } from "@bogo/shared";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValuesVM } from "../../viewmodels/field/use-field-values.js";
import { PersonFieldValues } from "../field/PersonFieldValues.js";
import { TagPicker } from "../TagPicker.js";
import { PersonAvatar } from "./PersonAvatar.js";

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

export interface PersonEditorFormProps {
	person: Person;
	persons: Person[];
	onUpdate: (id: string, fields: UpdatePersonInput) => void;
	onMove: (id: string, newManagerId: string | null) => void;
	onRemove: (id: string) => void;
	isRemoving: boolean;
	fieldDefs?: CustomFieldDefinition[];
	fieldValuesVm?: FieldValuesVM;
	/** panel = compact chart sidebar; page = full-page form */
	variant?: "panel" | "page";
}

/**
 * Shared person edit form used by the chart side panel and the dedicated
 * `/people/:id` page. Layout density differs by `variant`.
 */
export function PersonEditorForm({
	person,
	persons,
	onUpdate,
	onMove,
	onRemove,
	isRemoving,
	fieldDefs,
	fieldValuesVm,
	variant = "panel",
}: PersonEditorFormProps) {
	const [name, setName] = useState(person.name);
	const [title, setTitle] = useState(person.title);
	const [managerId, setManagerId] = useState<string | null>(person.managerId);
	const [dottedManagerId, setDottedManagerId] = useState<string | null>(person.dottedManagerId);
	const [avatarUrl, setAvatarUrl] = useState<string>(person.avatarUrl ?? "");

	useEffect(() => {
		setName(person.name);
		setTitle(person.title);
		setManagerId(person.managerId);
		setDottedManagerId(person.dottedManagerId);
		setAvatarUrl(person.avatarUrl ?? "");
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
		const fields: UpdatePersonInput = {};
		if (name.trim() && name.trim() !== person.name) {
			fields.name = name.trim();
		}
		if (title !== person.title) {
			fields.title = title;
		}
		if (dottedManagerId !== person.dottedManagerId) {
			fields.dottedManagerId = dottedManagerId;
		}
		const nextAvatar = avatarUrl.trim() === "" ? null : avatarUrl.trim();
		if (nextAvatar !== (person.avatarUrl ?? null)) {
			fields.avatarUrl = nextAvatar;
		}
		if (Object.keys(fields).length > 0) {
			onUpdate(person.id, fields);
		}
	}, [name, title, dottedManagerId, avatarUrl, person, onUpdate]);

	const eligibleDottedManagers = persons.filter((p) => p.id !== person.id && p.id !== managerId);
	const isPage = variant === "page";
	const fieldClass = isPage ? "field mt-1 w-full" : "field field-sm mt-1 w-full bg-background";
	const selectClass = isPage
		? "field-select mt-1 w-full"
		: "field-select field-sm mt-1 w-full bg-background";

	const hasCustomFields = Boolean(fieldDefs && fieldValuesVm && fieldDefs.length > 0);

	const avatarBlock = (
		<div>
			<span className="text-xs font-medium text-muted-foreground">Avatar</span>
			<div className="mt-1.5 flex items-center gap-3">
				<PersonAvatar name={name || person.name} avatarUrl={avatarUrl || null} size="lg" />
				<div className="min-w-0 flex-1 space-y-1">
					<input
						id="edit-avatar"
						type="url"
						value={avatarUrl}
						onChange={(e) => setAvatarUrl(e.target.value)}
						placeholder="https://… (leave empty for letter avatar)"
						className={fieldClass}
						aria-label="Avatar URL"
					/>
					<p className="text-[11px] text-muted-foreground">
						Leave blank to use a colored letter avatar.
					</p>
				</div>
			</div>
		</div>
	);

	const nameTitleBlock = (
		<div className={isPage ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
			<div>
				<label htmlFor="edit-name" className="text-xs font-medium text-muted-foreground">
					Name
				</label>
				<input
					id="edit-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={fieldClass}
				/>
			</div>
			<div>
				<label htmlFor="edit-title" className="text-xs font-medium text-muted-foreground">
					Title
				</label>
				<input
					id="edit-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Job title"
					className={fieldClass}
				/>
			</div>
		</div>
	);

	const managersBlock = (
		<div className={isPage ? "grid gap-4 sm:grid-cols-2" : "space-y-3"}>
			{!person.isRoot && (
				<div>
					<label htmlFor="edit-manager" className="text-xs font-medium text-muted-foreground">
						Manager
					</label>
					<select
						id="edit-manager"
						value={managerId ?? ""}
						onChange={(e) => handleManagerChange(e.target.value)}
						className={selectClass}
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
				<label htmlFor="edit-dotted" className="text-xs font-medium text-muted-foreground">
					Dotted-line manager
				</label>
				<select
					id="edit-dotted"
					value={dottedManagerId ?? ""}
					onChange={(e) => setDottedManagerId(e.target.value || null)}
					className={selectClass}
				>
					<option value="">None</option>
					{eligibleDottedManagers.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
			</div>
		</div>
	);

	const actions = (
		<div
			className={
				isPage
					? "page-toolbar border-t border-border/60 pt-3"
					: "flex items-center justify-between border-t border-border pt-2"
			}
		>
			<button type="button" onClick={handleSave} className="btn-primary">
				<Save className="h-3.5 w-3.5" strokeWidth={2} />
				Save
			</button>

			{!person.isRoot && (
				<button
					type="button"
					onClick={() => onRemove(person.id)}
					disabled={isRemoving}
					className="btn-destructive ml-auto"
					aria-label={`Delete ${person.name}`}
				>
					{isRemoving ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
					)}
					Delete
				</button>
			)}
		</div>
	);

	if (isPage) {
		return (
			<div className="flex flex-col gap-4">
				{/* Full-width two-column board — matches Settings / Table L2 panels */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<section className="panel-l2 space-y-4 p-4 md:p-5">
						<h2 className="text-sm font-semibold text-foreground">Profile</h2>
						{avatarBlock}
						{nameTitleBlock}
					</section>

					<section className="panel-l2 space-y-4 p-4 md:p-5">
						<h2 className="text-sm font-semibold text-foreground">Reporting</h2>
						{managersBlock}
					</section>

					{hasCustomFields && fieldDefs && fieldValuesVm ? (
						<section className="panel-l2 p-4 md:p-5">
							<h2 className="mb-3 text-sm font-semibold text-foreground">Custom fields</h2>
							<PersonFieldValues defs={fieldDefs} vm={fieldValuesVm} />
						</section>
					) : null}

					<section className="panel-l2 p-4 md:p-5">
						<h2 className="mb-3 text-sm font-semibold text-foreground">Tags</h2>
						<TagPicker scope="person" entityId={person.id} assignedTags={person.tags} />
					</section>
				</div>

				{actions}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="space-y-3">
				{avatarBlock}
				{nameTitleBlock}
				{managersBlock}
			</div>

			{hasCustomFields && fieldDefs && fieldValuesVm ? (
				<PersonFieldValues defs={fieldDefs} vm={fieldValuesVm} />
			) : null}

			<div>
				<span className="text-xs font-medium text-muted-foreground">Tags</span>
				<div className="mt-1.5">
					<TagPicker scope="person" entityId={person.id} assignedTags={person.tags} />
				</div>
			</div>

			{actions}
		</div>
	);
}
