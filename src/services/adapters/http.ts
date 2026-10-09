import { config } from "../../config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export interface ApiAdapter {
  request<T>(path: string, method?: string, data?: unknown): Promise<T>;
}
export class HttpAdapter implements ApiAdapter {
  private accessToken: string | undefined;
  async request<T>(path: string, method = "GET", data?: unknown): Promise<T> {
    const key = crypto.randomUUID();
    let response: Response;
    const send = () =>
      fetch(`${config.apiBase}/api${path}`, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    try {
      response = await send();
    } catch {
      try {
        response = await send();
      } catch {
        throw new ApiError(
          "Serverga ulanib bo‘lmadi. Internet va backendni tekshiring.",
          0,
        );
      }
    }
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "So‘rov bajarilmadi" }));
      throw new ApiError(error.error || "So‘rov bajarilmadi", response.status);
    }
    const result = await response.json();
    if (path.startsWith("/auth/") && result.accessToken)
      this.accessToken = result.accessToken;
    if (path === "/auth/logout") this.accessToken = undefined;
    return result;
  }
}
