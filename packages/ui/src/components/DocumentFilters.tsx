import type { DocumentType, Person, Tag } from "@bogo/shared";
import { Button, Input } from "@nocoo/basalt";
import { X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { PersonAvatar } from "./person/PersonAvatar.js";
import { PersonHover } from "./person/PersonHover.js";
import { TagBadge } from "./TagBadge.js";

export interface DocumentFiltersValue {
	keyword: string;
	typeId: string | "all";
	dateFrom: string;
	dateTo: string;
	tagIds: string[];
	personIds: string[];
}

export const EMPTY_FILTERS: DocumentFiltersValue = {
	keyword: "",
	typeId: "all",
	dateFrom: "",
	dateTo: "",
	tagIds: [],
	personIds: [],
};

interface DocumentFiltersProps {
	value: DocumentFiltersValue;
	onChange: (next: DocumentFiltersValue) => void;
	docTypes: DocumentType[];
	allTags: Tag[];
	allPersons: Person[];
}

export function DocumentFilters({
	value,
	onChange,
	docTypes,
	allTags,
	allPersons,
}: DocumentFiltersProps) {
	const activeCount = useMemo(() => countActive(value), [value]);

	const patch = useCallback(
		(p: Partial<DocumentFiltersValue>) => onChange({ ...value, ...p }),
		[value, onChange],
	);

	const clear = useCallback(() => onChange(EMPTY_FILTERS), [onChange]);

	const toggleTag = useCallback(
		(tagId: string) => {
			const next = value.tagIds.includes(tagId)
				? value.tagIds.filter((id) => id !== tagId)
				: [...value.tagIds, tagId];
			patch({ tagIds: next });
		},
		[value.tagIds, patch],
	);

	const togglePerson = useCallback(
		(personId: string) => {
			const next = value.personIds.includes(personId)
				? value.personIds.filter((id) => id !== personId)
				: [...value.personIds, personId];
			patch({ personIds: next });
		},
		[value.personIds, patch],
	);

	return (
		<div id="document-filters-panel" className="space-y-4 py-1">
			{activeCount > 0 && (
				<div className="flex items-center justify-end pb-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={clear}
						className="gap-1 text-xs text-basalt-muted-foreground hover:text-basalt-foreground"
						aria-label="Clear all filters"
					>
						<X className="h-3 w-3" />
						Clear
					</Button>
				</div>
			)}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{/* Keyword */}
				<div className="space-y-1.5">
					<FieldLabel htmlFor="filter-keyword" label="Keyword" />
					<Input
						id="filter-keyword"
						type="text"
						value={value.keyword}
						onChange={(e) => patch({ keyword: e.target.value })}
						placeholder="Search title…"
						className="h-9 min-w-0 w-full"
					/>
				</div>

				{/* Type */}
				<div className="space-y-1.5">
					<FieldLabel htmlFor="filter-type" label="Type" />
					<select
						id="filter-type"
						value={value.typeId}
						onChange={(e) => patch({ typeId: e.target.value })}
						className="field-select h-9 w-full"
					>
						<option value="all">All types</option>
						<option value="none">No type</option>
						{docTypes.map((dt) => (
							<option key={dt.id} value={dt.id}>
								{dt.name}
							</option>
						))}
					</select>
				</div>

				{/* Date range */}
				<div className="space-y-1.5 md:col-span-2 xl:col-span-1">
					<FieldLabel label="Event date" />
					<div className="flex items-center gap-2">
						<Input
							type="date"
							value={value.dateFrom}
							onChange={(e) => patch({ dateFrom: e.target.value })}
							className="h-9 min-w-0 w-full"
							aria-label="Date from"
						/>
						<span className="text-basalt-muted-foreground text-xs shrink-0">to</span>
						<Input
							type="date"
							value={value.dateTo}
							onChange={(e) => patch({ dateTo: e.target.value })}
							className="h-9 min-w-0 w-full"
							aria-label="Date to"
						/>
					</div>
				</div>

				{/* Tags */}
				<div className="space-y-1.5 md:col-span-2 xl:col-span-3">
					<FieldLabel label="Tags" />
					{allTags.length === 0 ? (
						<p className="text-xs text-basalt-muted-foreground">No tags defined</p>
					) : (
						<div className="flex flex-wrap items-center gap-1.5">
							{allTags.map((tag) => {
								const isActive = value.tagIds.includes(tag.id);
								return (
									<button
										key={tag.id}
										type="button"
										onClick={() => toggleTag(tag.id)}
										className={`rounded-full transition-shadow ${isActive ? "ring-2 ring-basalt-primary ring-offset-2 ring-offset-basalt-card" : "hover:ring-2 hover:ring-basalt-border"}`}
										aria-pressed={isActive}
										aria-label={`${isActive ? "Remove" : "Add"} tag filter ${tag.name}`}
									>
										<TagBadge name={tag.name} color={tag.color} size="sm" />
									</button>
								);
							})}
						</div>
					)}
				</div>

				{/* People */}
				<div className="space-y-1.5 md:col-span-2 xl:col-span-3">
					<FieldLabel label="People" />
					{allPersons.length === 0 ? (
						<p className="text-xs text-basalt-muted-foreground">No people defined</p>
					) : (
						<div className="flex flex-wrap items-center gap-1.5">
							{allPersons.map((p) => {
								const isActive = value.personIds.includes(p.id);
								return (
									<PersonHover key={p.id} personId={p.id}>
										<button
											type="button"
											onClick={() => togglePerson(p.id)}
											className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
												isActive
													? "border-basalt-primary bg-basalt-primary/10 text-basalt-foreground"
													: "border-basalt-border text-basalt-muted-foreground hover:border-basalt-primary/40 hover:text-basalt-foreground"
											}`}
											aria-pressed={isActive}
											aria-label={`${isActive ? "Remove" : "Add"} person filter ${p.name}`}
										>
											<PersonAvatar name={p.name} avatarUrl={p.avatarUrl} size="xs" />
											<span className="truncate max-w-[120px]">{p.name}</span>
										</button>
									</PersonHover>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function FieldLabel({ label, htmlFor }: { label: string; htmlFor?: string }) {
	return (
		<label
			htmlFor={htmlFor}
			className="block text-[11px] font-medium uppercase tracking-wider text-basalt-muted-foreground"
		>
			{label}
		</label>
	);
}

export function countActive(v: DocumentFiltersValue): number {
	let n = 0;
	if (v.keyword.trim() !== "") n++;
	if (v.typeId !== "all") n++;
	if (v.dateFrom !== "") n++;
	if (v.dateTo !== "") n++;
	if (v.tagIds.length > 0) n += v.tagIds.length;
	if (v.personIds.length > 0) n += v.personIds.length;
	return n;
}
