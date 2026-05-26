import { useEffect, useState } from "react";

interface UserInfo {
	email: string | null;
	displayName: string;
	initials: string;
}

function extractUserInfo(email: string | null): UserInfo {
	if (!email) {
		return { email: null, displayName: "User", initials: "U" };
	}
	const local = email.split("@")[0];
	const displayName = local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	const parts = displayName.trim().split(/\s+/);
	const initials =
		parts.length >= 2
			? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
			: local.slice(0, 2).toUpperCase();
	return { email, displayName, initials };
}

export function useUserInfo(): UserInfo {
	const [info, setInfo] = useState<UserInfo>(() => extractUserInfo(null));

	useEffect(() => {
		fetch("/api/me")
			.then((r) => r.json())
			.then((body: { data: { email: string | null } }) => {
				setInfo(extractUserInfo(body.data.email));
			})
			.catch(() => undefined);
	}, []);

	return info;
}
