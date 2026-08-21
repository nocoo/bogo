import { sha256Hex } from "./hash.js";

export const AUTHOR_PROFILE_ENDPOINT = "https://lizheng.blog/api/authors/profile";

export type AuthorProfile = {
	name: string | null;
	avatar: string | null;
};

const EMPTY_PROFILE: AuthorProfile = { name: null, avatar: null };

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function emailSha256Hex(email: string): Promise<string> {
	return sha256Hex(normalizeEmail(email));
}

function readProfile(body: unknown): AuthorProfile {
	if (typeof body !== "object" || body === null) {
		return { ...EMPTY_PROFILE };
	}
	const rec = body as { name?: unknown; avatar?: unknown };
	return {
		name: typeof rec.name === "string" ? rec.name : null,
		avatar: typeof rec.avatar === "string" ? rec.avatar : null,
	};
}

export async function lookupAuthorProfile(email: string): Promise<AuthorProfile> {
	const hash = await emailSha256Hex(email);
	try {
		const res = await fetch(`${AUTHOR_PROFILE_ENDPOINT}?hash=${encodeURIComponent(hash)}`, {
			signal: AbortSignal.timeout(2000),
		});
		if (!res.ok) {
			return { ...EMPTY_PROFILE };
		}
		return readProfile(await res.json());
	} catch {
		return { ...EMPTY_PROFILE };
	}
}
