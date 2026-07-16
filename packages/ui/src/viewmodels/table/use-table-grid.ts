import type { PersonTableView } from "@bogo/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { fieldModel } from "@/models/field.model";
import { personModel } from "@/models/person.model";
import { buildGrid } from "./apply-sort-filter.js";

export function useTableGrid(view: PersonTableView | null) {
	const { workspaceId } = useWorkspaceContext();
	const wid = workspaceId ?? "";

	const personsQuery = useQuery(personModel.listQueryOptions(wid));
	const defsQuery = useQuery(fieldModel.defsQueryOptions(wid));
	const valuesQuery = useQuery(fieldModel.allValuesQueryOptions(wid));

	const grid = useMemo(() => {
		if (!view || !personsQuery.data || !defsQuery.data || !valuesQuery.data) {
			return null;
		}
		return buildGrid(view, personsQuery.data, defsQuery.data, valuesQuery.data);
	}, [view, personsQuery.data, defsQuery.data, valuesQuery.data]);

	return {
		grid,
		persons: personsQuery.data ?? [],
		defs: defsQuery.data ?? [],
		isLoading: personsQuery.isLoading || defsQuery.isLoading || valuesQuery.isLoading,
		isError: personsQuery.isError || defsQuery.isError || valuesQuery.isError,
	};
}
