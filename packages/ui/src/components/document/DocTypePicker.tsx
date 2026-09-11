import type { DocumentType } from "@bogo/shared";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@nocoo/basalt";
import { Check, ChevronDown } from "lucide-react";

export function DocTypePicker({
	types,
	value,
	onChange,
	disabled,
}: {
	types: DocumentType[];
	value: string | null;
	onChange: (typeId: string | null) => void;
	disabled?: boolean;
}) {
	const selected = types.find((type) => type.id === value);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className="w-full justify-start"
					aria-label="Change document type"
				>
					<span
						className="h-2 w-2 shrink-0 rounded-full bg-basalt-muted-foreground"
						style={selected?.color ? { backgroundColor: selected.color } : undefined}
						aria-hidden="true"
					/>
					<span className="min-w-0 flex-1 truncate text-left">{selected?.name ?? "No type"}</span>
					<ChevronDown
						className="h-4 w-4 shrink-0 text-basalt-muted-foreground"
						strokeWidth={1.5}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{[{ id: "none", name: "No type", color: null }, ...types].map((type) => (
					<DropdownMenuItem
						key={type.id}
						role="menuitemradio"
						aria-checked={(value ?? "none") === type.id}
						onSelect={() => onChange(type.id === "none" ? null : type.id)}
					>
						<span
							className="mr-2 h-2 w-2 shrink-0 rounded-full bg-basalt-muted-foreground"
							style={type.color ? { backgroundColor: type.color } : undefined}
						/>
						<span className="flex-1 truncate">{type.name}</span>
						{(value ?? "none") === type.id && (
							<Check className="ml-2 h-4 w-4 text-basalt-primary" strokeWidth={1.5} />
						)}
					</DropdownMenuItem>
				))}
				{types.length === 0 && (
					<p className="px-2 py-1.5 text-xs text-basalt-muted-foreground">No types defined</p>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
