import type { Person } from "@bogo/shared";
import { Button, Input, LayerCard } from "@nocoo/basalt";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@nocoo/basalt/components/select";
import { Plus, UserX, X } from "lucide-react";
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
		<LayerCard className="w-full shadow-lg sm:w-80">
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-semibold text-basalt-foreground">Add Person</h3>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 text-basalt-muted-foreground hover:text-basalt-foreground"
					aria-label="Close create dialog"
				>
					<X className="h-4 w-4" strokeWidth={1.5} />
				</Button>
			</div>

			<div className="space-y-3">
				<div>
					<label htmlFor="person-name" className="text-xs text-basalt-muted-foreground">
						Name
					</label>
					<Input
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
						className="mt-1 w-full"
						autoFocus={true}
					/>
				</div>

				<div>
					<label htmlFor="person-manager" className="text-xs text-basalt-muted-foreground">
						Reports to
					</label>
					<Select value={managerId} onValueChange={setManagerId}>
						<SelectTrigger id="person-manager" className="mt-1 w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{persons.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-2 pt-1">
					<Button
						onClick={handleSubmit}
						disabled={!(name.trim() && managerId) || isCreating}
						loading={isCreating}
						size="sm"
					>
						<Plus className="h-3 w-3" strokeWidth={2} />
						{isCreating ? "Creating..." : "Create"}
					</Button>
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancel
					</Button>
				</div>
			</div>
		</LayerCard>
	);
}

export function EmptyPersonState() {
	return (
		<div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
			<UserX className="h-12 w-12 text-basalt-muted-foreground" strokeWidth={1} />
			<p className="mt-4 text-sm text-basalt-muted-foreground">No people in this workspace yet</p>
			<p className="mt-1 text-xs text-basalt-muted-foreground">
				The workspace root person is created automatically
			</p>
		</div>
	);
}
