import type { DocumentType, Person, Tag } from "@bogo/shared";
import { ChevronDown, Filter, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PersonAvatar } from "./person/PersonAvatar.js";
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

/**
 * Collapsible filter bar for the documents list. Collapsed by default;
 * the toggle row shows an active-count and a Clear shortcut. Expanded
 * panel offers four dimensions: keyword (title contains), type, event
 * date range, tag set, and people set.
 *
 * Filtering itself is owned by the parent — this component is a pure
 * controlled input.
 */
export function DocumentFilters({
	value,
	onChange,
	docTypes,
	allTags,
	allPersons,
}: DocumentFiltersProps) {
	const [open, setOpen] = useState(false);

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
		<div className="rounded-card bg-secondary">
			{/* Collapsed bar */}
			<div className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className="flex flex-1 items-center gap-2 text-left -my-1 py-1 rounded hover:bg-accent/40 transition-colors"
					aria-expanded={open}
					aria-controls="document-filters-panel"
				>
					<Filter className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
					<span className="font-medium">Filters</span>
					{activeCount > 0 && (
						<span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
							{activeCount}
						</span>
					)}
					<ChevronDown
						className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${
							open ? "rotate-180" : ""
						}`}
						strokeWidth={1.6}
					/>
				</button>
				{activeCount > 0 && (
					<button
						type="button"
						onClick={clear}
						className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
						aria-label="Clear all filters"
					>
						<X className="h-3 w-3" />
						Clear
					</button>
				)}
			</div>

			{/* Expanded panel */}
			{open && (
				<div
					id="document-filters-panel"
					className="grid gap-4 border-t border-border px-4 py-4 sm:grid-cols-2"
				>
					{/* Keyword */}
					<div className="space-y-1.5 sm:col-span-2">
						<FieldLabel htmlFor="filter-keyword" label="Keyword" />
						<input
							id="filter-keyword"
							type="text"
							value={value.keyword}
							onChange={(e) => patch({ keyword: e.target.value })}
							placeholder="Search title…"
							className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
						/>
					</div>

					{/* Type */}
					<div className="space-y-1.5">
						<FieldLabel htmlFor="filter-type" label="Type" />
						<select
							id="filter-type"
							value={value.typeId}
							onChange={(e) => patch({ typeId: e.target.value })}
							className="h-9 w-full rounded-md border border-border bg-background pl-3 pr-8 text-sm text-foreground outline-none focus:border-primary"
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
					<div className="space-y-1.5">
						<FieldLabel label="Event date" />
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={value.dateFrom}
								onChange={(e) => patch({ dateFrom: e.target.value })}
								className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary"
								aria-label="Date from"
							/>
							<span className="text-muted-foreground text-xs shrink-0">to</span>
							<input
								type="date"
								value={value.dateTo}
								onChange={(e) => patch({ dateTo: e.target.value })}
								className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary"
								aria-label="Date to"
							/>
						</div>
					</div>

					{/* Tags */}
					<div className="space-y-1.5 sm:col-span-2">
						<FieldLabel label="Tags" />
						{allTags.length === 0 ? (
							<p className="text-xs text-muted-foreground">No tags defined</p>
						) : (
							<div className="flex flex-wrap items-center gap-1.5">
								{allTags.map((tag) => {
									const isActive = value.tagIds.includes(tag.id);
									return (
										<button
											key={tag.id}
											type="button"
											onClick={() => toggleTag(tag.id)}
											className={`transition-opacity ${
												isActive ? "opacity-100" : "opacity-50 hover:opacity-80"
											}`}
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
					<div className="space-y-1.5 sm:col-span-2">
						<FieldLabel label="People" />
						{allPersons.length === 0 ? (
							<p className="text-xs text-muted-foreground">No people defined</p>
						) : (
							<div className="flex flex-wrap items-center gap-1.5">
								{allPersons.map((p) => {
									const isActive = value.personIds.includes(p.id);
									return (
										<button
											key={p.id}
											type="button"
											onClick={() => togglePerson(p.id)}
											className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors ${
												isActive
													? "border-primary bg-primary/10 text-foreground"
													: "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
											}`}
											aria-pressed={isActive}
											aria-label={`${isActive ? "Remove" : "Add"} person filter ${p.name}`}
										>
											<PersonAvatar name={p.name} avatarUrl={p.avatarUrl} size="xs" />
											<span className="truncate max-w-[120px]">{p.name}</span>
										</button>
									);
								})}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

function FieldLabel({ label, htmlFor }: { label: string; htmlFor?: string }) {
	return (
		<label
			htmlFor={htmlFor}
			className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			{label}
		</label>
	);
}

function countActive(v: DocumentFiltersValue): number {
	let n = 0;
	if (v.keyword.trim() !== "") n++;
	if (v.typeId !== "all") n++;
	if (v.dateFrom !== "") n++;
	if (v.dateTo !== "") n++;
	if (v.tagIds.length > 0) n++;
	if (v.personIds.length > 0) n++;
	return n;
}
