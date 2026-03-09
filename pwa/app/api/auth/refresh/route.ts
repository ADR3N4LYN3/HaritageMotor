import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    const response = NextResponse.json({ error: "Refresh failed" }, { status: 401 });
    response.cookies.delete("refresh_token");
    return response;
  }

  const data = await res.json();

  const response = NextResponse.json({
    access_token: data.access_token,
    user: data.user,
  });

  // Update refresh token cookie
  response.cookies.set("refresh_token", data.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
