// src/lib/http.ts
// مساعدات HTTP responses - HTTP response helpers
// الهدف: توحيد شكل أخطاء الـ API وجعلها مفهومة للفريق / Goal: consistent, informative API errors for the whole team

import { NextResponse } from "next/server";

// شكل الخطأ الموحد - Standard API error shape
export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;        // كود ثابت للبرمجة - stable code for client/programmatic handling
    message: string;     // رسالة واضحة للمستخدم - human-readable message (Arabic-first)
    details?: unknown;   // تفاصيل إضافية للمطور - optional developer details
  };
};

// ok() => رد نجاح موحد - unified success response
export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

// fail() => رد خطأ موحد - unified error response
export function fail(code: string, message: string, status = 400, details?: unknown) {
  const body: ApiErrorBody = { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

// readJsonBody() => قراءة JSON بأمان - safely parse JSON body with informative 400 on bad input
export async function readJsonBody<T = unknown>(req: Request): Promise<{ data: T } | { error: ReturnType<typeof fail> }> {
  const contentType = String(req.headers.get("content-type") || "");
  // تحقق بسيط من نوع المحتوى - basic content-type guard (helps catch wrong client usage)
  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    return {
      error: fail(
        "INVALID_CONTENT_TYPE",
        "نوع المحتوى غير صحيح - Content-Type must be application/json",
        415,
        { received: contentType }
      ),
    };
  }

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return { error: fail("BODY_READ_ERROR", "تعذر قراءة محتوى الطلب - Could not read request body", 400) };
  }

  if (!raw.trim()) {
    return { error: fail("EMPTY_BODY", "محتوى الطلب فارغ - Request body is empty; expected JSON", 400) };
  }

  try {
    return { data: JSON.parse(raw) as T };
  } catch (e: any) {
    // خطأ JSON ليس خطأ سيرفر 500 - malformed JSON is a client/input error (400), not server failure
    return {
      error: fail(
        "INVALID_JSON",
        "صيغة JSON غير صحيحة - Malformed JSON in request body",
        400,
        { parseError: String(e?.message || e) }
      ),
    };
  }
}
