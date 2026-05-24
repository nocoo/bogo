export class ApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

export interface ApiResponse<T> {
	data: T;
}

export interface ApiErrorResponse {
	error: { code: string; message?: string };
}

async function handleResponse<T>(res: Response): Promise<T> {
	if (!res.ok) {
		let code = "UNKNOWN";
		let message = res.statusText;
		try {
			const body: ApiErrorResponse = await res.json();
			code = body.error.code;
			message = body.error.message ?? message;
		} catch {
			// response body is not JSON — use defaults
		}
		throw new ApiError(res.status, code, message);
	}
	const body: ApiResponse<T> = await res.json();
	return body.data;
}

export type RequestOptions = Omit<RequestInit, "body"> & {
	body?: unknown;
};

export function createClient(baseUrl = "") {
	async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
		const { body, headers, ...rest } = opts;
		const res = await fetch(`${baseUrl}${path}`, {
			headers: { "Content-Type": "application/json", ...headers },
			body: body !== undefined ? JSON.stringify(body) : undefined,
			...rest,
		});
		return handleResponse<T>(res);
	}

	return { request };
}

export type Client = ReturnType<typeof createClient>;
