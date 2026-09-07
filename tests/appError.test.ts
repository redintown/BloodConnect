import { describe, expect, it } from "vitest";
import { AppError, NotImplementedError } from "@/lib/errors/AppError";

describe("AppError", () => {
  it("maps each factory to the right status code", () => {
    expect(AppError.validation().status).toBe(400);
    expect(AppError.unauthenticated().status).toBe(401);
    expect(AppError.unauthorized().status).toBe(403);
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.conflict().status).toBe(409);
    expect(AppError.rateLimited().status).toBe(429);
    expect(AppError.server().status).toBe(500);
  });

  it("never leaks the internal cause into userMessage", () => {
    const err = AppError.server(new Error("raw SQL: relation does not exist"));
    expect(err.userMessage).not.toContain("SQL");
  });

  it("NotImplementedError still carries a safe, generic userMessage", () => {
    const err = new NotImplementedError("matchingService.matchDonors");
    expect(err.userMessage).toBe("This feature isn't available yet.");
    expect(err.message).toContain("matchingService.matchDonors");
  });
});
