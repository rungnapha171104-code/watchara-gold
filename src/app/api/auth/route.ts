import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json().catch(() => ({}));
  const real = process.env.APP_PASSCODE;
  if (!real || passcode !== real) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(real), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
