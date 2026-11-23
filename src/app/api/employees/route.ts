// src/app/api/employees/route.ts
// قائمة الموظفين وإضافة موظف - list employees and create a new employee
// الموظفون المحذوفون مخفيون افتراضياً، ولا يمكن إظهارهم إلا لمن يملك صلاحية الاستعادة
// Deleted employees are hidden by default; including them requires restore capability

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail, ok, readJsonBody } from "@/lib/http";
import { canCreateEmployee, canRead, canRestoreEmployee, normalizeRole, ROLES } from "@/lib/permissions";
import { EMPLOYEE_STATUSES, isEmployeeStatus } from "@/lib/employee-status";
import { isValidEmail } from "@/lib/password-policy";

// الحالات المعروضة في تفاصيل خطأ الحالة - advertised in INVALID_STATUS details
const ALLOWED_EMPLOYEE_STATUSES = EMPLOYEE_STATUSES;

// GET /api/employees
// جلب قائمة الموظفين - list employees (latest first)
export async function GET(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canRead(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    // includeDeleted=true يظهر المحذوفين أيضاً، ويحتاج صلاحية الاستعادة
    // includeDeleted=true reveals soft-deleted rows and requires restore capability
    const includeDeleted = new URL(req.url).searchParams.get("includeDeleted") === "true";
    if (includeDeleted && !canRestoreEmployee(s.role)) {
      return fail("FORBIDDEN", "غير مصرح - forbidden", 403);
    }

    const employees = await prisma.employee.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        account: {
          select: { id: true, email: true, role: true, active: true, provisionedBy: true },
        },
      },
    });

    // الأدمن يرى ملخصاً مختصراً فقط - ADMIN gets a strictly minimal projection
    if (normalizeRole(s.role) === ROLES.ADMIN) {
      return ok({
        employees: employees.map((e) => ({
          employeeId: e.employeeCode,
          name: e.name,
          email: e.email,
          status: e.status,
        })),
      });
    }

    // باقي الأدوار ترى السجل الكامل مع ملخص الحساب المرتبط
    // Every other role gets the full record plus a projected account summary
    return ok({
      employees: employees.map((e) => ({
        ...e,
        account: e.account
          ? {
              id: e.account.id,
              email: e.account.email,
              role: e.account.role,
              active: e.account.active,
              provisionedBy: e.account.provisionedBy,
            }
          : null,
      })),
    });
  } catch (e) {
    console.error("EMPLOYEES_GET_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}

// POST /api/employees
// إضافة موظف جديد - create a new employee
export async function POST(req: Request) {
  try {
    const s = await getSession();
    if (!s) return fail("UNAUTHORIZED", "غير مصرح - authentication required", 401);
    if (!canCreateEmployee(s.role)) return fail("FORBIDDEN", "غير مصرح - forbidden", 403);

    const parsed = await readJsonBody<Record<string, unknown>>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail("INVALID_BODY", "صيغة الطلب غير صحيحة - JSON body must be an object", 400);
    }

    const employeeCode = String(body.employeeCode ?? "").trim();
    const name = String(body.name ?? "").trim();
    // تحقق من الحقول الإلزامية - required field validation
    if (!employeeCode || !name) {
      return fail("MISSING_FIELDS", "رقم الموظف والاسم مطلوبان - employeeCode and name are required", 400, {
        required: ["employeeCode", "name"],
      });
    }

    // البريد اختياري، لكنه يُتحقق منه عند وجوده - email is optional but validated when present
    let email: string | null = null;
    const rawEmail = String(body.email ?? "").trim();
    if (rawEmail !== "") {
      if (!isValidEmail(rawEmail)) {
        return fail("INVALID_EMAIL", "بريد إلكتروني غير صالح - invalid email", 400, { received: body.email });
      }
      email = rawEmail;
    }

    // الحالة الافتراضية ACTIVE، وأي قيمة أخرى تمر عبر المحقق المشترك
    // Status defaults to ACTIVE; any supplied value must pass the shared guard
    let status = "ACTIVE";
    const rawStatus = String(body.status ?? "").trim();
    if (rawStatus !== "") {
      if (!isEmployeeStatus(rawStatus)) {
        return fail("INVALID_STATUS", "حالة غير صالحة - invalid status", 400, {
          received: body.status,
          allowed: ALLOWED_EMPLOYEE_STATUSES,
        });
      }
      status = rawStatus;
    }

    // منع التكرار - prevent duplicate employeeCode
    const exists = await prisma.employee.findUnique({ where: { employeeCode } });
    if (exists) return fail("DUPLICATE_EMPLOYEE_CODE", "رقم الموظف مستخدم بالفعل - employeeCode already exists", 409);

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        email,
        department: String(body.department ?? "").trim() || null,
        title: String(body.title ?? "").trim() || null,
        phone: String(body.phone ?? "").trim() || null,
        status,
        createdBy: s.sub,
      },
    });
    return ok({ employee }, 201);
  } catch (e) {
    console.error("EMPLOYEES_POST_ERROR", e);
    return fail("INTERNAL_ERROR", "حدث خطأ داخلي - internal server error", 500);
  }
}
