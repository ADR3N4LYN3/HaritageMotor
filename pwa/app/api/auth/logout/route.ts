import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const authHeader = req.headers.get("authorization");

  // Call backend logout with the refresh token from the httpOnly cookie
  if (refreshToken && authHeader) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort — don't block logout if backend is unreachable
    }
  }

  // Always clear the cookie regardless of backend result
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("refresh_token");
  return response;
}
