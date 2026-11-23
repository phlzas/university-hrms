// src/lib/password-policy.ts
// سياسة كلمة المرور والتحقق من البريد - password strength and email validation helpers
// تُستخدم في إنشاء الموظفين وتحديثهم وتفعيل الحسابات - shared by employee POST/PATCH and account provisioning

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*]/.test(value)
  );
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}
