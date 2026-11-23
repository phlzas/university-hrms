// src/lib/db.ts
// عميل Prisma مشترك - shared PrismaClient singleton
// في التطوير نعيد استخدام نفس العميل لتجنب كثرة الاتصالات - reuse client in dev to avoid too many connections

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// prisma => العميل المستخدم في كل الـ API routes - exported DB client for all server routes
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
