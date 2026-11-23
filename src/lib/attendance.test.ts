// src/lib/attendance.test.ts
// اختبارات وحدة لمنطق الحضور - Unit tests for attendance utility logic
// تغطي التحويل والتصنيف والتطبيع - covers parsing, classification, and normalization

import { classifyAttendance, normalizeDate, normalizeTime, parseTimeToMinutes } from "@/lib/attendance";

describe("parseTimeToMinutes", () => {
  it("parses valid HH:MM", () => {
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(parseTimeToMinutes("8:05")).toBe(485);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });
  it("returns null for invalid", () => {
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes("25:00")).toBeNull();
    expect(parseTimeToMinutes("abc")).toBeNull();
  });
});

describe("classifyAttendance", () => {
  it("marks absent when no check-in", () => {
    expect(classifyAttendance(null, "16:00").status).toBe("ABSENT");
  });
  it("marks present within grace", () => {
    expect(classifyAttendance("08:00", "16:00", "08:00", 20)).toMatchObject({ status: "PRESENT", minutesLate: 0 });
    expect(classifyAttendance("08:20", "16:00", "08:00", 20)).toMatchObject({ status: "GRACE", minutesLate: 20 });
  });
  it("marks late after grace", () => {
    expect(classifyAttendance("08:21", "16:00", "08:00", 20)).toMatchObject({ status: "LATE", minutesLate: 21 });
  });
  it("marks incomplete when missing checkout", () => {
    expect(classifyAttendance("08:00", null, "08:00", 20).status).toBe("INCOMPLETE");
  });
});

describe("normalizeDate", () => {
  it("normalizes ISO date", () => {
    const d = normalizeDate("2026-04-10");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-04-10");
  });
  it("returns null for empty", () => {
    expect(normalizeDate("")).toBeNull();
  });
});

describe("normalizeTime", () => {
  it("normalizes time strings", () => {
    expect(normalizeTime("8:05")).toBe("08:05");
    expect(normalizeTime("08:05:30")).toBe("08:05");
  });
  it("normalizes excel fraction", () => {
    expect(normalizeTime(0.5)).toBe("12:00");
  });
  it("returns undefined for invalid", () => {
    expect(normalizeTime("")).toBeUndefined();
  });
});
