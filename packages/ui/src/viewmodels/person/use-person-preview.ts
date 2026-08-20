import type { CustomFieldDefinition, CustomFieldValue, Person } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceContext } from "../../contexts/workspace-context.js";
import { formatDateWithDistance } from "../../lib/date-distance.js";
import { fieldModel } from "../../models/field.model.js";
import { personModel } from "../../models/person.model.js";

export type PersonPreviewField = {
	name: string;
	value: string;
};

export type PersonPreview = {
	person: Person | null;
	manager: Person | null;
	fields: PersonPreviewField[];
};

export function formatPreviewFieldValue(
	value: string,
	def: CustomFieldDefinition | undefined,
): string {
	if (!def) return value;
	if (def.fieldType === "boolean") {
		if (value === "true") return "Yes";
		if (value === "false") return "No";
		return value;
	}
	if (def.fieldType === "date") {
		return formatDateWithDistance(value);
	}
	return value;
}

export function buildPersonPreview(
	personId: string,
	persons: Person[],
	defs: CustomFieldDefinition[],
	values: CustomFieldValue[],
): PersonPreview {
	const person = persons.find((p) => p.id === personId) ?? null;
	const manager = person?.managerId
		? (persons.find((p) => p.id === person.managerId) ?? null)
		: null;
	const chartDefs = defs.filter((d) => d.showOnChart).sort((a, b) => a.sortOrder - b.sortOrder);
	const fields = chartDefs.flatMap((def) => {
		const stored = values.find((v) => v.personId === personId && v.fieldDefId === def.id);
		if (!stored || stored.value === "") return [];
		return [{ name: def.name, value: formatPreviewFieldValue(stored.value, def) }];
	});
	return { person, manager, fields };
}

export function usePersonPreview(personId: string): PersonPreview {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const { data: persons } = useQuery(personModel.listQueryOptions(wid));
	const { data: defs } = useQuery(fieldModel.defsQueryOptions(wid));
	const { data: values } = useQuery(fieldModel.allValuesQueryOptions(wid, Boolean(wid)));

	return useMemo(
		() => buildPersonPreview(personId, persons ?? [], defs ?? [], values ?? []),
		[personId, persons, defs, values],
	);
}
