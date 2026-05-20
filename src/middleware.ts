import { unsealData } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_TTL, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];
const SESSION_COOKIE = "zona-one-session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const session = await unsealData<SessionData>(cookieValue, {
      password: process.env.SESSION_PASSWORD!,
      ttl: SESSION_TTL,
    });
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch {
    // Cookie inválida, expirada o manipulada
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)"],
};
