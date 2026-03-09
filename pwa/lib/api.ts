import { useAppStore } from "@/store/app.store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const store = useAppStore.getState();
  const token = store.accessToken;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      store.setAccessToken(newToken);
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
      });
    } else {
      store.logout();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new ApiError(res.status, body.error || body.message || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: "POST",
      body: formData,
    }),
};

export { ApiError };
