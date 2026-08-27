import { NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/auth";

const COOKIE_NAME = "session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  const sitePasscode = process.env.SITE_PASSCODE;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sitePasscode || !sessionSecret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  if (passcode !== sitePasscode) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const token = await signSession(sessionSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return res;
}
