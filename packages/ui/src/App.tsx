import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LogsPage } from "@/pages/LogsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SystemPage } from "@/pages/SystemPage";
import { UsersPage } from "@/pages/UsersPage";
import { BrowserRouter, Route, Routes } from "react-router";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<DashboardLayout />}>
					<Route path="/" element={<DashboardPage />} />
					<Route path="/analytics" element={<AnalyticsPage />} />
					<Route path="/users" element={<UsersPage />} />
					<Route path="/logs" element={<LogsPage />} />
					<Route path="/system" element={<SystemPage />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}
