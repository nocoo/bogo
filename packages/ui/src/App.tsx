import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppProviders } from "@/contexts/app-providers";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DocumentEditorPage } from "@/pages/DocumentEditorPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { LogsPage } from "@/pages/LogsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SystemPage } from "@/pages/SystemPage";
import { UsersPage } from "@/pages/UsersPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
	return (
		<AppProviders>
			<BrowserRouter>
				<Routes>
					<Route element={<DashboardLayout />}>
						<Route path="/" element={<DashboardPage />} />
						<Route path="/workspaces" element={<WorkspacesPage />} />
						<Route path="/documents" element={<DocumentsPage />} />
						<Route path="/documents/:id" element={<DocumentEditorPage />} />
						<Route path="/analytics" element={<AnalyticsPage />} />
						<Route path="/users" element={<UsersPage />} />
						<Route path="/logs" element={<LogsPage />} />
						<Route path="/system" element={<SystemPage />} />
						<Route path="/settings" element={<SettingsPage />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</AppProviders>
	);
}
