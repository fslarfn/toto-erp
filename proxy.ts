import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/session";

const PUBLIC_PREFIXES = [
  "/login",
  "/absen",
  "/alucurv-absen",
  "/invoice",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/push/vapid-key",
  "/api/cron/",
  "/api/kuesioner/isi/",
  "/api/alucurv/absensi/",
];

const SIDOARJO_DASHBOARD = "/dashboard/sidoarjo";
const SIDOARJO_SESSION_ENDPOINTS = new Set([
  "/api/auth/supabase-token",
  "/api/auth/change-password",
  "/api/profile/update",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const session = await verifySession(token);
    if (session.role === "sidoarjo_manager") {
      if (pathname.startsWith("/api/") && !SIDOARJO_SESSION_ENDPOINTS.has(pathname)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (
        !pathname.startsWith("/api/") &&
        pathname !== SIDOARJO_DASHBOARD &&
        !pathname.startsWith(SIDOARJO_DASHBOARD + "/")
      ) {
        return NextResponse.redirect(new URL(SIDOARJO_DASHBOARD, request.url));
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-username", session.username);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("erp_session");
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
