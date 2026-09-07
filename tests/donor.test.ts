import { describe, expect, it } from "vitest";
import { donorProfileSchema } from "@/schemas/donor.schema";
import { isEligibleFromLastDonation, nextEligibleDate } from "@/lib/donors/eligibility";
import { toDonorPublicSummary } from "@/lib/donors/publicSummary";
import { locationService } from "@/services/locationService";
import type { DonorProfile } from "@/types/domain";

const ownProfile: DonorProfile = {
  id: "donor-1",
  userId: "user-1",
  bloodGroup: "O_NEG",
  lastDonationDate: "2026-01-01",
  isEligible: false,
  verificationStatus: "UNVERIFIED",
  location: { latitude: 23.8103, longitude: 90.4125 },
  isAvailable: true,
  isAvailableAtNight: true,
  emergencyResponseEnabled: false,
  emergencyRadiusKm: 10,
};

describe("donor profile schema", () => {
  it("accepts a valid profile payload", () => {
    const result = donorProfileSchema.safeParse({
      bloodGroup: "O_NEG",
      lastDonationDate: "2026-01-01",
      location: { latitude: 23.81, longitude: 90.41 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a last donation date in the future", () => {
    const result = donorProfileSchema.safeParse({
      bloodGroup: "A_POS",
      lastDonationDate: "2099-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("treats an empty last donation date as null", () => {
    const result = donorProfileSchema.safeParse({
      bloodGroup: "B_POS",
      lastDonationDate: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lastDonationDate).toBeNull();
  });
});

describe("eligibility", () => {
  it("is eligible when there is no last donation", () => {
    expect(isEligibleFromLastDonation(null)).toBe(true);
  });

  it("uses a 56-day interval", () => {
    expect(nextEligibleDate("2026-01-01")).toBe("2026-02-26");
    expect(isEligibleFromLastDonation("2026-01-01", new Date("2026-02-25T12:00:00.000Z"))).toBe(false);
    expect(isEligibleFromLastDonation("2026-01-01", new Date("2026-02-26T00:00:00.000Z"))).toBe(true);
  });
});

describe("location privacy", () => {
  it("omits exact coordinates from the public summary", () => {
    const summary = toDonorPublicSummary(ownProfile, 3);
    expect(summary).not.toHaveProperty("location");
    expect(JSON.stringify(summary)).not.toContain("23.8103");
    expect(JSON.stringify(summary)).not.toContain("90.4125");
    expect(summary.distanceKm).toBe(3);
  });

  it("encodes WGS84 points as longitude-first WKT", () => {
    expect(locationService.encodeWgs84Point({ latitude: 23.81, longitude: 90.41 })).toBe(
      "SRID=4326;POINT(90.41 23.81)"
    );
    expect(
      locationService.decodeWgs84Point({ type: "Point", coordinates: [90.41, 23.81] })
    ).toEqual({ latitude: 23.81, longitude: 90.41 });
  });
});
