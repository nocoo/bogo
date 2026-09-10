import { TooltipProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WorkspaceProvider } from "./workspace-context.js";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: true,
			retry: 1,
		},
	},
});

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider defaultTheme="system" storageKey="theme">
			<AccentProvider
				defaultAccent="primary"
				paletteOverrides={{
					primary: {
						light: "237 66% 69%",
						dark: "237 66% 69%",
					},
				}}
			>
				<TooltipProvider>
					<QueryClientProvider client={queryClient}>
						<WorkspaceProvider>{children}</WorkspaceProvider>
					</QueryClientProvider>
				</TooltipProvider>
			</AccentProvider>
		</ThemeProvider>
	);
}
