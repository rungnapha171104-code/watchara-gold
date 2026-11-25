import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const pass = process.env.APP_PASSCODE;
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth") return NextResponse.next();
  if (!pass) return new NextResponse("ยังไม่ได้ตั้งค่า APP_PASSCODE", { status: 500 });
  const ok = req.cookies.get(AUTH_COOKIE)?.value === (await authToken(pass));
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
