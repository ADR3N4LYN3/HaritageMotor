import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const authHeader = req.headers.get("authorization");

  // Call backend logout with the refresh token from the httpOnly cookie
  // Always attempt if we have a refresh token — auth header is optional
  if (refreshToken) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort — don't block logout if backend is unreachable
    }
  }

  // Always clear cookies regardless of backend result
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("refresh_token");
  response.cookies.delete("user_role");
  return response;
}
