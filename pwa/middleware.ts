import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for refresh token cookie — if absent, user is not authenticated
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Protect /admin — only superadmin role (UX guard, backend enforces real RBAC)
  if (pathname.startsWith("/admin")) {
    const role = req.cookies.get("user_role")?.value;
    if (role !== "superadmin") {
      const scanUrl = req.nextUrl.clone();
      scanUrl.pathname = "/scan";
      return NextResponse.redirect(scanUrl);
    }
  }

  // Protect /users — only admin role (UX guard, backend enforces real RBAC)
  if (pathname.startsWith("/users")) {
    const role = req.cookies.get("user_role")?.value;
    if (role !== "admin") {
      const scanUrl = req.nextUrl.clone();
      scanUrl.pathname = "/scan";
      return NextResponse.redirect(scanUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons|manifest\\.json|favicon\\.ico).*)"],
};
