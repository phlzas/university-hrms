// src/lib/auth.ts
// إدارة جلسة المصادقة عبر JWT cookie - JWT cookie session helpers
// الكوكي HttpOnly للأمان الأساسي في MVP - HttpOnly cookie for basic MVP security

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "hrms_session"; // اسم الكوكي - session cookie name
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export type SessionPayload = { sub: string; email: string; role: string; name: string };

// createSession() => إنشاء JWT ووضعه في كوكي - sign JWT and set it as HttpOnly cookie
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

// clearSession() => مسح كوكي الجلسة عند تسجيل الخروج - remove session cookie on logout
export async function clearSession() {
  const c = await cookies();
  c.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

// getSession() => قراءة الجلسة الحالية إن وجدت - read and verify current session; returns null if invalid/missing
export async function getSession(): Promise<SessionPayload | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// requireSession() => رمي خطأ إذا لا توجد جلسة - throw when session missing (useful in guarded server logic)
export async function requireSession() {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
