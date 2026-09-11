import { Toaster as BasaltToaster } from "@nocoo/basalt";
import { useTheme } from "@nocoo/basalt/providers/theme";

export function Toaster() {
	const { theme } = useTheme();
	return <BasaltToaster theme={theme} />;
}
