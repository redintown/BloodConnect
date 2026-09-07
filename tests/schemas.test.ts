import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/schemas/auth.schema";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";

describe("auth schemas", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "+8801700000000",
      password: "password123",
      confirmPassword: "password123",
      initialRole: "DONOR",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "+8801700000000",
      password: "password123",
      confirmPassword: "different",
      initialRole: "REQUESTER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid login email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});

describe("createBloodRequestSchema", () => {
  const base = {
    bloodGroup: "O_NEG",
    quantityUnits: 2,
    urgency: "CRITICAL",
    location: { latitude: 23.8103, longitude: 90.4125 },
    contactName: "Requester",
    contactPhone: "+8801700000000",
  };

  it("requires either a hospitalId or a freeform hospital name", () => {
    const result = createBloodRequestSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("accepts a request with a freeform hospital name", () => {
    const result = createBloodRequestSchema.safeParse({
      ...base,
      hospitalNameFreeform: "City General Hospital",
    });
    expect(result.success).toBe(true);
  });
});
