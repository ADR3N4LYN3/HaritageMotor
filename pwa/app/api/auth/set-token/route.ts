import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("refresh_token", refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
