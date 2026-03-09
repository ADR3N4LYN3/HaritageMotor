import { api, ApiError } from "./api";
import { useAppStore } from "@/store/app.store";
import type { User } from "./types";

type LoginResult =
  | { step: "complete"; user: User }
  | { step: "mfa"; mfa_token: string };

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "Login failed");
  }

  const data = await res.json();

  if (data.mfa_required) {
    return { step: "mfa", mfa_token: data.mfa_token };
  }

  // Store tokens
  const store = useAppStore.getState();
  store.setAccessToken(data.access_token);
  store.setUser(data.user);

  // Store refresh token via Next.js API route (httpOnly cookie)
  await fetch("/api/auth/set-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: data.refresh_token }),
  });

  return { step: "complete", user: data.user };
}

export async function verifyMFA(
  mfaToken: string,
  code: string
): Promise<User> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/auth/mfa/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "MFA verification failed");
  }

  const data = await res.json();

  const store = useAppStore.getState();
  store.setAccessToken(data.access_token);
  store.setUser(data.user);

  await fetch("/api/auth/set-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: data.refresh_token }),
  });

  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Ignore errors during logout
  }
  await fetch("/api/auth/clear-token", { method: "POST" });
  useAppStore.getState().logout();
}
