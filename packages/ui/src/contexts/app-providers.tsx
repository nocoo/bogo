import { LinkProvider, TooltipProvider } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { WorkspaceProvider } from "./workspace-context.js";

function AppLink({
	href,
	className,
	children,
}: {
	href: string;
	className?: string;
	children?: ReactNode;
}) {
	if (
		href.startsWith("http:") ||
		href.startsWith("https:") ||
		href.startsWith("mailto:") ||
		href.startsWith("tel:")
	) {
		return (
			<a href={href} className={className}>
				{children}
			</a>
		);
	}
	return (
		<Link to={href} className={className}>
			{children}
		</Link>
	);
}

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
				<LinkProvider render={AppLink}>
					<TooltipProvider>
						<QueryClientProvider client={queryClient}>
							<WorkspaceProvider>{children}</WorkspaceProvider>
						</QueryClientProvider>
					</TooltipProvider>
				</LinkProvider>
			</AccentProvider>
		</ThemeProvider>
	);
}
