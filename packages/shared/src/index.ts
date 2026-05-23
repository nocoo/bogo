export const BOGO_VERSION = "0.1.0";

export interface LiveResponse {
	status: "ok" | "error";
	version: string;
	component: string;
	timestamp: string;
	uptime: number;
}
