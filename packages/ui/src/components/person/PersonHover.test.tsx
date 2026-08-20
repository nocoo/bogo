import type { Person } from "@bogo/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { PersonHover } from "./PersonHover.js";

const MINA: Person = {
	id: "p-mina",
	workspaceId: "ws-1",
	name: "Mina Park",
	title: "VP Engineering",
	managerId: "p-wei",
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [{ id: "t-mgr", name: "Manager", color: "#1d4ed8" }],
};

const WEI: Person = {
	id: "p-wei",
	workspaceId: "ws-1",
	name: "Wei Chen",
	title: "CEO",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [],
};

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Northwind",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const mockFetch = vi.fn();

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockImplementation(async (input: RequestInfo) => {
		const url = String(input);
		if (url.includes("/persons")) {
			return new Response(JSON.stringify({ data: [WEI, MINA] }), { status: 200 });
		}
		if (url.includes("/fields/values")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "v1",
							workspaceId: "ws-1",
							personId: "p-mina",
							fieldDefId: "f-dept",
							value: "Engineering",
						},
					],
				}),
				{ status: 200 },
			);
		}
		if (url.includes("/fields")) {
			return new Response(
				JSON.stringify({
					data: [
						{
							id: "f-dept",
							workspaceId: "ws-1",
							name: "Department",
							fieldType: "select",
							options: ["Engineering"],
							sortOrder: 0,
							required: false,
							defaultValue: null,
							showOnChart: true,
							createdAt: "2026-01-01",
						},
					],
				}),
				{ status: 200 },
			);
		}
		return new Response(JSON.stringify({ data: [] }), { status: 200 });
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

function Hydrate({ children }: { children: ReactNode }) {
	const ctx = useWorkspaceContext();
	useEffect(() => {
		if (!ctx.workspaceId) ctx.switchWorkspace(WS);
	}, [ctx]);
	if (!ctx.workspaceId) return null;
	return children;
}

function renderHover(ui: ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	client.setQueryData(["persons", "ws-1"], [WEI, MINA]);
	client.setQueryData(
		["fieldDefs", "ws-1"],
		[
			{
				id: "f-dept",
				workspaceId: "ws-1",
				name: "Department",
				fieldType: "select",
				options: ["Engineering"],
				sortOrder: 0,
				required: false,
				defaultValue: null,
				showOnChart: true,
				createdAt: "2026-01-01",
			},
		],
	);
	client.setQueryData(
		["fieldValues", "ws-1", "__all"],
		[
			{
				id: "v1",
				workspaceId: "ws-1",
				personId: "p-mina",
				fieldDefId: "f-dept",
				value: "Engineering",
			},
		],
	);
	return render(
		<QueryClientProvider client={client}>
			<WorkspaceProvider>
				<MemoryRouter>
					<Hydrate>{ui}</Hydrate>
				</MemoryRouter>
			</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

describe("PersonHover", () => {
	it("renders children without a card when personId is missing", () => {
		render(
			<PersonHover>
				<button type="button">Mina</button>
			</PersonHover>,
		);
		expect(screen.getByText("Mina")).toBeTruthy();
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("renders children without a card outside the workspace provider", () => {
		render(
			<PersonHover personId="p-mina">
				<button type="button">Mina</button>
			</PersonHover>,
		);
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("makes the trigger keyboard-focusable", () => {
		renderHover(
			<PersonHover personId="p-mina">
				<span>Mina</span>
			</PersonHover>,
		);
		const trigger = screen.getByText("Mina").closest("span[tabindex]");
		expect(trigger?.getAttribute("tabindex")).toBe("0");
	});

	it("opens a preview card after hover delay", async () => {
		renderHover(
			<PersonHover personId="p-mina">
				<button type="button">Mina</button>
			</PersonHover>,
		);

		fireEvent.mouseEnter(screen.getByText("Mina"));
		expect(screen.queryByRole("tooltip")).toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});

		const tip = screen.getByRole("tooltip");
		expect(tip.textContent).toContain("Mina Park");
		expect(tip.textContent).toContain("VP Engineering");
		expect(tip.textContent).toContain("Wei Chen");
		expect(tip.textContent).toContain("Department");
		expect(tip.textContent).toContain("Engineering");
		expect(tip.textContent).toContain("Manager");
		expect(screen.getByRole("link", { name: "Open profile" }).getAttribute("href")).toBe(
			"/people/p-mina",
		);
	});

	it("flips the card when the trigger is near the viewport edge", async () => {
		renderHover(
			<PersonHover personId="p-mina">
				<button type="button">Mina</button>
			</PersonHover>,
		);
		const trigger = screen.getByText("Mina");
		const span = trigger.closest("span");
		expect(span).toBeTruthy();
		vi.spyOn(span as HTMLElement, "getBoundingClientRect").mockReturnValue({
			top: 700,
			bottom: 720,
			left: 900,
			right: 980,
			width: 80,
			height: 20,
			x: 900,
			y: 700,
			toJSON: () => ({}),
		});

		fireEvent.mouseEnter(trigger);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		const tip = screen.getByRole("tooltip");
		expect(Number.parseFloat(tip.style.left)).toBeLessThan(900);
		expect(Number.parseFloat(tip.style.top)).toBeLessThan(720);
	});

	it("closes the card after leave delay", async () => {
		renderHover(
			<PersonHover personId="p-mina">
				<button type="button">Mina</button>
			</PersonHover>,
		);
		const trigger = screen.getByText("Mina");
		fireEvent.mouseEnter(trigger);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		expect(screen.getByRole("tooltip")).toBeTruthy();

		fireEvent.mouseLeave(trigger);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(200);
		});
		expect(screen.queryByRole("tooltip")).toBeNull();
	});
});
