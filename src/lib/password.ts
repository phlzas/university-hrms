// src/lib/password.ts
// دوال تشفير والتحقق من كلمات المرور - password hashing and verification helpers (bcryptjs)

import bcrypt from "bcryptjs";

// hashPassword() => إنشاء hash آمن لكلمة المرور - hash plain password before storing in DB
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// verifyPassword() => مقارنة كلمة المرور مع hash المخزن - compare plain password against stored hash
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
