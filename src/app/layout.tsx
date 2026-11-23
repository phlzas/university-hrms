// src/app/layout.tsx
// الـ Root layout للتطبيق بالكامل - root layout for the whole Next.js app
// يضبط اللغة العربية والاتجاه RTL والخط - sets Arabic locale, RTL direction, and global font/styles

import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

// Metadata الافتراضية للتطبيق - default app metadata
export const metadata: Metadata = {
  title: "نظام الموارد البشرية - HRMS",
  description: "نظام إدارة الموارد البشرية للجامعة",
};

// RootLayout() => يغلف كل الصفحات - wraps every page in the app
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} font-sans bg-slate-50 text-slate-900`}>{children}</body>
    </html>
  );
}
