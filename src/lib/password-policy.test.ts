// src/lib/password-policy.test.ts
// اختبارات وحدة لسياسة كلمة المرور والبريد - unit tests for password policy and email validation
// تغطي الحدود والقيم المرفوضة - covers boundaries and rejection cases

import { isStrongPassword, isValidEmail } from "@/lib/password-policy";

describe("isStrongPassword", () => {
  it("accepts a password meeting every rule", () => {
    expect(isStrongPassword("SecurePass1!")).toBe(true);
  });

  it("accepts a password of exactly eight characters", () => {
    expect(isStrongPassword("Abcdef1!")).toBe(true);
  });

  it("rejects a password shorter than eight characters", () => {
    expect(isStrongPassword("Abcde1!")).toBe(false);
  });

  it("rejects a password without an uppercase letter", () => {
    expect(isStrongPassword("securepass1!")).toBe(false);
  });

  it("rejects a password without a lowercase letter", () => {
    expect(isStrongPassword("SECUREPASS1!")).toBe(false);
  });

  it("rejects a password without a digit", () => {
    expect(isStrongPassword("SecurePass!")).toBe(false);
  });

  it("rejects a password without an approved special character", () => {
    expect(isStrongPassword("SecurePass1")).toBe(false);
  });

  it("rejects a special character outside the approved set", () => {
    expect(isStrongPassword("SecurePass1?")).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(isStrongPassword("")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a standard email address", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts subdomains and plus tags", () => {
    expect(isValidEmail("first.last+tag@sub.example.co.uk")).toBe(true);
  });

  it("rejects an address without an @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects an address without a dot in the domain", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  it("rejects an address with whitespace", () => {
    expect(isValidEmail("user name@example.com")).toBe(false);
  });

  it("rejects an empty local part", () => {
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("rejects an empty domain", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("does not trim or lowercase its input", () => {
    expect(isValidEmail(" User@Example.com ")).toBe(false);
  });
});
