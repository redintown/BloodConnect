import { describe, expect, it } from "vitest";
import { createBloodRequestSchema } from "@/schemas/bloodRequest.schema";
import { locationService } from "@/services/locationService";
import {
  assertOwnsRequest,
  assertRequesterIdImmutable,
  assertRequesterStatusChange,
  canRequesterCancel,
  canRequesterEdit,
  canSystemExpire,
  initialRequestStatus,
  isOverdueForExpiry,
} from "@/lib/requests/statusRules";
import { AppError } from "@/lib/errors/AppError";
import { readFileSync } from "fs";
import path from "path";

const validCreate = {
  bloodGroup: "O_NEG" as const,
  quantityUnits: 2,
  urgency: "CRITICAL" as const,
  location: { latitude: 23.8103, longitude: 90.4125 },
  contactName: "Requester",
  contactPhone: "+8801700000000",
  hospitalNameFreeform: "City General Hospital",
  requiredBy: "2026-09-08T12:00:00.000Z",
  notes: "Urgent surgery",
};

describe("blood request validation", () => {
  it("accepts a complete create payload", () => {
    const result = createBloodRequestSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it("rejects missing hospital and invalid quantity", () => {
    expect(
      createBloodRequestSchema.safeParse({
        ...validCreate,
        hospitalNameFreeform: null,
        hospitalId: null,
      }).success
    ).toBe(false);
    expect(
      createBloodRequestSchema.safeParse({ ...validCreate, quantityUnits: 0 }).success
    ).toBe(false);
  });
});

describe("create / PENDING initial status", () => {
  it("always starts as PENDING", () => {
    expect(initialRequestStatus()).toBe("PENDING");
  });
});

describe("ownership and requester_id immutability", () => {
  it("rejects a non-owner requesterId", () => {
    expect(() => assertOwnsRequest("owner-1", "intruder")).toThrow(AppError);
    try {
      assertOwnsRequest("owner-1", "intruder");
    } catch (error) {
      expect((error as AppError).code).toBe("AUTHORIZATION_ERROR");
    }
  });

  it("blocks requester_id mutation", () => {
    expect(() => assertRequesterIdImmutable("user-a", "user-b")).toThrow(AppError);
    expect(() => assertRequesterIdImmutable("user-a", "user-a")).not.toThrow();
  });
});

describe("cancellation and blocked status changes", () => {
  it("allows cancel from PENDING and MATCHING only", () => {
    expect(canRequesterCancel("PENDING")).toBe(true);
    expect(canRequesterCancel("MATCHING")).toBe(true);
    expect(canRequesterCancel("COMPLETED")).toBe(false);
    expect(canRequesterEdit("PENDING")).toBe(true);
    expect(canRequesterEdit("MATCHING")).toBe(false);
  });

  it("blocks unauthorized requester status transitions", () => {
    expect(() => assertRequesterStatusChange("PENDING", "CANCELLED")).not.toThrow();
    expect(() => assertRequesterStatusChange("PENDING", "MATCHING")).toThrow(AppError);
    expect(() => assertRequesterStatusChange("PENDING", "EXPIRED")).toThrow(AppError);
    expect(() => assertRequesterStatusChange("COMPLETED", "CANCELLED")).toThrow(AppError);
  });
});

describe("expireOverdue rules", () => {
  it("only marks overdue open requests as expirAble", () => {
    expect(canSystemExpire("PENDING")).toBe(true);
    expect(canSystemExpire("COMPLETED")).toBe(false);
    expect(
      isOverdueForExpiry("PENDING", "2026-01-01T00:00:00.000Z", new Date("2026-01-02T00:00:00.000Z"))
    ).toBe(true);
    expect(
      isOverdueForExpiry("PENDING", "2026-01-03T00:00:00.000Z", new Date("2026-01-02T00:00:00.000Z"))
    ).toBe(false);
    expect(isOverdueForExpiry("PENDING", null, new Date("2026-01-02T00:00:00.000Z"))).toBe(false);
  });
});

describe("request location handling", () => {
  it("encodes longitude-first WKT and decodes GeoJSON", () => {
    expect(locationService.encodeWgs84Point({ latitude: 23.81, longitude: 90.41 })).toBe(
      "SRID=4326;POINT(90.41 23.81)"
    );
    expect(
      locationService.decodeWgs84Point({ latitude: 23.81, longitude: 90.41 })
    ).toEqual({ latitude: 23.81, longitude: 90.41 });
  });

  it("does not put exact location on the list-card contract fields", () => {
    // BloodRequestCard only renders blood group, urgency, status, units, hospital name.
    const cardSafe = {
      bloodGroup: validCreate.bloodGroup,
      quantityUnits: validCreate.quantityUnits,
      urgency: validCreate.urgency,
      status: initialRequestStatus(),
      hospitalNameFreeform: validCreate.hospitalNameFreeform,
    };
    expect(JSON.stringify(cardSafe)).not.toContain("23.8103");
    expect(JSON.stringify(cardSafe)).not.toContain("90.4125");
  });
});

describe("no matching side effects", () => {
  it("does not import matchingService or write blood_request_matches", () => {
    const servicePath = path.resolve(__dirname, "../src/services/bloodRequestService.ts");
    const source = readFileSync(servicePath, "utf8");
    expect(source).not.toContain("matchingService");
    expect(source).not.toContain('.from("blood_request_matches")');
    expect(source).not.toContain("notificationService");
    expect(initialRequestStatus()).toBe("PENDING");
    expect(() => assertRequesterStatusChange("PENDING", "MATCHING")).toThrow(AppError);
  });
});
