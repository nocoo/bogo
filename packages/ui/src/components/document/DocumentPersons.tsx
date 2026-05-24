import type { DocumentPerson, Person } from "@bogo/shared";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
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
	error,
	onDismissError,
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
	error: Error | null;
	onDismissError: () => void;
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
			<div className="flex items-center gap-2 py-2" aria-label="Loading persons">
				<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				<span className="text-xs text-muted-foreground">Loading associations…</span>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<h3 className="text-sm font-semibold text-foreground">Associated People</h3>

			{personsError && (
				<div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
					Failed to load associations: {personsError.message}
				</div>
			)}

			{error && (
				<div className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
					<span className="flex-1">{error.message}</span>
					<button
						type="button"
						onClick={onDismissError}
						className="shrink-0 text-red-400 hover:text-red-300"
						aria-label="Dismiss association error"
					>
						✕
					</button>
				</div>
			)}

			{allPersonsError && (
				<div className="rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-400">
					Failed to load people: {allPersonsError.message}
				</div>
			)}

			{persons.length === 0 && (
				<p className="text-xs text-muted-foreground">No people associated yet.</p>
			)}

			<div className="space-y-1">
				{persons.map((dp) => {
					const person = allPersons.find((p) => p.id === dp.personId);
					return (
						<div
							key={dp.personId}
							className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs bg-card border border-border"
						>
							<span className="flex-1 truncate font-medium text-foreground">
								{person?.name ?? dp.personId}
							</span>
							<span className="text-muted-foreground">{dp.role}</span>
							<button
								type="button"
								onClick={() => onRemove(dp.personId)}
								disabled={isRemoving}
								className="shrink-0 text-muted-foreground hover:text-red-400 disabled:opacity-50 transition-colors"
								aria-label={`Remove ${person?.name ?? "person"}`}
							>
								<UserMinus className="h-3.5 w-3.5" />
							</button>
						</div>
					);
				})}
			</div>

			{allPersonsLoading ? (
				<div className="flex items-center gap-2 py-1" aria-label="Loading people">
					<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
					<span className="text-xs text-muted-foreground">Loading people…</span>
				</div>
			) : (
				available.length > 0 && (
					<div className="flex items-center gap-2">
						<select
							value={selectedPersonId}
							onChange={(e) => setSelectedPersonId(e.target.value)}
							className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
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
							className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
							aria-label="Add person"
						>
							{isAdding ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<UserPlus className="h-3.5 w-3.5" />
							)}
							Add
						</button>
					</div>
				)
			)}
		</div>
	);
}
