import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/api/me";

export interface UserInfo {
	email: string | null;
	displayName: string;
	initials: string;
	avatarUrl: string | null;
}

function initialsFrom(displayName: string, local: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}
	return (local || displayName).slice(0, 2).toUpperCase();
}

export function extractUserInfo(me: Partial<Me> | null | undefined): UserInfo {
	const email = me?.email ?? null;
	const avatarUrl = typeof me?.avatar === "string" && me.avatar ? me.avatar : null;
	const profileName = typeof me?.name === "string" ? me.name.trim() : "";

	if (!email && !profileName) {
		return { email: null, displayName: "User", initials: "U", avatarUrl };
	}

	const local = email ? email.split("@")[0] : "";
	const fromEmail = local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	const displayName = profileName || fromEmail || "User";

	return {
		email,
		displayName,
		initials: initialsFrom(displayName, local),
		avatarUrl,
	};
}

export function useUserInfo(): UserInfo {
	const [info, setInfo] = useState<UserInfo>(() => extractUserInfo(null));

	useEffect(() => {
		api.me
			.get()
			.then((me) => {
				setInfo(extractUserInfo(me));
			})
			.catch(() => undefined);
	}, []);

	return info;
}
