import { NextRequest, NextResponse } from "next/server";

const VALID_ROLES = ["superadmin", "admin", "operator", "technician", "viewer"];

export async function POST(req: NextRequest) {
  const { refresh_token, user_role } = await req.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("refresh_token", refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // Store role in a separate cookie for middleware route protection.
  // This is a UX guard only — the backend enforces real RBAC.
  if (user_role && VALID_ROLES.includes(user_role)) {
    response.cookies.set("user_role", user_role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return response;
}
