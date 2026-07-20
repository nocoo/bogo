import type { DocumentPerson, Person } from "@bogo/shared";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { PersonChip } from "../../components/person/PersonChip.js";
import type { AddPersonInput } from "../../viewmodels/document/use-document.js";

export function DocumentPersons({
	persons,
	allPersons,
	isLoading,
	personsError,
	allPersonsLoading,
	allPersonsError,
	onAdd,
	isAdding,
	onRemove,
	isRemoving,
	compact = false,
}: {
	persons: DocumentPerson[];
	allPersons: Person[];
	isLoading: boolean;
	personsError: Error | null;
	allPersonsLoading: boolean;
	allPersonsError: Error | null;
	onAdd: (input: AddPersonInput, opts?: { onSuccess?: () => void }) => void;
	isAdding: boolean;
	onRemove: (personId: string, opts?: { onSuccess?: () => void }) => void;
	isRemoving: boolean;
	/** When true, omits the built-in "Associated People" heading — useful when
	 * embedded under an external section label. */
	compact?: boolean;
}) {
	const [selectedPersonId, setSelectedPersonId] = useState("");

	const linkedIds = new Set(persons.map((p) => p.personId));
	const available = allPersons.filter((p) => !linkedIds.has(p.id));

	const handleAdd = useCallback(() => {
		if (!selectedPersonId) {
			return;
		}
		onAdd({ personId: selectedPersonId }, { onSuccess: () => setSelectedPersonId("") });
	}, [selectedPersonId, onAdd]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 py-2" role="status" aria-label="Loading persons">
				<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				<span className="text-xs text-muted-foreground">Loading associations…</span>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{!compact && <h3 className="text-sm font-semibold text-foreground">Associated People</h3>}

			{personsError && (
				<div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
					Failed to load associations: {personsError.message}
				</div>
			)}

			{allPersonsError && (
				<div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
					Failed to load people: {allPersonsError.message}
				</div>
			)}

			{!personsError && persons.length === 0 && (
				<p className="text-xs text-muted-foreground">No people associated yet.</p>
			)}

			<div className="flex flex-col gap-1.5">
				{persons.map((dp) => {
					const person = allPersons.find((p) => p.id === dp.personId);
					return (
						<PersonChip
							key={dp.personId}
							name={person?.name ?? dp.personId}
							avatarUrl={person?.avatarUrl}
							subtitle={person?.title || undefined}
							onRemove={() => onRemove(dp.personId)}
							isRemoving={isRemoving}
						/>
					);
				})}
			</div>

			{!personsError &&
				(allPersonsLoading ? (
					<div className="flex items-center gap-2 py-1" role="status" aria-label="Loading people">
						<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
						<span className="text-xs text-muted-foreground">Loading people…</span>
					</div>
				) : (
					available.length > 0 && (
						<div className="flex items-center gap-2">
							<select
								value={selectedPersonId}
								onChange={(e) => setSelectedPersonId(e.target.value)}
								className="flex-1 rounded-md border border-border bg-secondary pl-3 pr-8 py-2 text-xs text-foreground outline-none focus:border-primary transition-colors"
								aria-label="Select person to add"
							>
								<option value="">Select person…</option>
								{available.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={handleAdd}
								disabled={!selectedPersonId || isAdding}
								className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
								aria-label="Add person"
							>
								{isAdding ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Plus className="h-3.5 w-3.5" />
								)}
								Add
							</button>
						</div>
					)
				))}
		</div>
	);
}
