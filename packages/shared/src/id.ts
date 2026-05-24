export function generateId(): string {
	const timestamp = Date.now();
	const timestampHex = timestamp.toString(16).padStart(12, "0");

	const randomBytes = new Uint8Array(10);
	crypto.getRandomValues(randomBytes);
	const randomHex = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	const hex = timestampHex + randomHex;

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		`7${hex.slice(13, 16)}`,
		((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") +
			hex.slice(18, 20),
		hex.slice(20, 32),
	].join("-");
}
