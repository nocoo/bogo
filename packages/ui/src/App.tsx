import { BrowserRouter, Route, Routes } from "react-router";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Toaster } from "@/components/ui/toaster";
import { AppProviders } from "@/contexts/app-providers";
import { DocTypesSettingsPage } from "@/pages/DocTypesSettingsPage";
import { DocumentEditorPage } from "@/pages/DocumentEditorPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { FieldsSettingsPage } from "@/pages/FieldsSettingsPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { PeoplePage } from "@/pages/PeoplePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TagsSettingsPage } from "@/pages/TagsSettingsPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";

export function App() {
	return (
		<AppProviders>
			<BrowserRouter>
				<Routes>
					<Route element={<DashboardLayout />}>
						<Route path="/" element={<OverviewPage />} />
						<Route path="/documents" element={<DocumentsPage />} />
						<Route path="/documents/:id" element={<DocumentEditorPage />} />
						<Route path="/people" element={<PeoplePage />} />
						<Route path="/workspaces" element={<WorkspacesPage />} />
						<Route path="/settings" element={<SettingsPage />} />
						<Route path="/settings/doc-types" element={<DocTypesSettingsPage />} />
						<Route path="/settings/fields" element={<FieldsSettingsPage />} />
						<Route path="/settings/tags" element={<TagsSettingsPage />} />
					</Route>
				</Routes>
			</BrowserRouter>
			<Toaster />
		</AppProviders>
	);
}
