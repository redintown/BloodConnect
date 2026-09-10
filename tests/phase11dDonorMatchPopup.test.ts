import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS } from "@/lib/constants/bloodGroups";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

function readCode(rel: string) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const POPUP = "src/components/forms/DonorMatchPopup.tsx";
const OVERLAY = "src/components/forms/DonorPortalMatchOverlay.tsx";
const LAYOUT = "src/app/(donor)/layout.tsx";
const MODAL = "src/components/ui/Modal.tsx";
const SHEET = "src/components/ui/BottomSheet.tsx";
const DASHBOARD = "src/app/(donor)/donor/page.tsx";

describe("Phase 11D Step 2 — single mount and shared dialog", () => {
  it("mounts the popup only through the overlay in the donor layout", () => {
    const layout = read(LAYOUT);
    expect(layout.match(/<DonorPortalMatchOverlay/g)?.length).toBe(1);
    expect(read(OVERLAY)).toContain("<DonorMatchPopup matches={actionableMatches} />");
    expect(readCode(DASHBOARD)).not.toContain("DonorMatchPopup");
    expect(readCode(DASHBOARD)).not.toContain("DonorPortalMatchOverlay");
  });

  it("uses BottomSheet/Modal instead of a parallel dialog system", () => {
    expect(read(POPUP)).toContain("BottomSheet");
    expect(read(SHEET)).toContain('placement="sheet"');
    expect(read(MODAL)).toContain('role="dialog"');
    expect(read(MODAL)).toContain("useFocusTrap");
    expect(readCode(POPUP)).not.toContain("createPortal");
    expect(readCode(POPUP)).not.toContain("fixed inset-0 z-50");
  });

  it("leaves overlay selection logic unchanged", () => {
    const overlay = read(OVERLAY);
    expect(overlay).toContain("listMatchesForDonor");
    expect(overlay).toContain("selectActionableDonorMatches");
    expect(overlay).toContain("shouldShowDonorMatchPopup");
  });
});

describe("Phase 11D Step 2 — actions and decision controls", () => {
  const popup = read(POPUP);
  const code = readCode(POPUP);

  it("reuses existing accept, decline and on-the-way actions", () => {
    expect(popup).toContain("acceptMatchAction");
    expect(popup).toContain("declineMatchAction");
    expect(popup).toContain("markOnTheWayAction");
    expect(popup).toContain("markNotificationReadAction");
    expect(popup).not.toContain("acceptEmergencyMatchAction");
    expect(popup).not.toContain("accept_blood_request_match");
  });

  it("keeps YES/NO equal weight and emergency copy", () => {
    expect(popup).toContain("YES, I CAN HELP");
    expect(popup).toContain("NO, I CANNOT");
    expect(popup).toContain("grid grid-cols-2");
    expect(popup).toContain('size="lg"');
    // Decline must not use the destructive variant.
    expect(code).not.toContain('variant="destructive"');
    expect(popup).toContain('variant="secondary"');
  });

  it("blocks duplicate submissions while an action is in flight", () => {
    expect(popup).toContain("if (!current || busy) return");
    expect(popup).toContain("if (!acceptedItem || busy) return");
    expect(popup).toContain("disabled={busy}");
    expect(popup).toContain('loading={loading === "accept"}');
    expect(popup).toContain('loading={loading === "decline"}');
    expect(popup).toContain("dismissible={!busy}");
  });

  it("preserves Maybe later as a non-mutating dismiss", () => {
    expect(popup).toContain("Maybe later");
    expect(popup).toContain("dismissedThisVisit");
    expect(popup).toContain("does not decline");
  });
});

describe("Phase 11D Step 2 — emergency vs normal presentation", () => {
  const popup = read(POPUP);

  it("derives mode from request.isEmergency and exposes data-popup-mode", () => {
    expect(popup).toContain('current?.request.isEmergency ? "emergency" : "normal"');
    expect(popup).toContain("data-popup-mode={mode}");
  });

  it("applies emergency styling only when the match is emergency", () => {
    expect(popup).toContain("isEmergency &&");
    expect(popup).toContain("border-l-emergency");
    expect(popup).toContain('variant={isEmergency ? "emergency" : "primary"}');
    expect(popup).toContain("Emergency response");
  });

  it("uses human-readable blood group and urgency labels", () => {
    expect(popup).toContain("BLOOD_GROUP_LABELS");
    expect(popup).toContain("URGENCY_LABELS");
    expect(popup).toContain("Critical urgency");
    expect(readCode(POPUP)).not.toContain(">CRITICAL<");
    expect(readCode(POPUP)).not.toContain(">HIGH<");
    expect(readCode(POPUP)).not.toContain(">MODERATE<");
    for (const group of BLOOD_GROUPS) {
      expect(BLOOD_GROUP_LABELS[group]).toBeTruthy();
    }
  });
});

describe("Phase 11D Step 2 — privacy and status language", () => {
  const code = readCode(POPUP);

  it("uses coarse distance only", () => {
    expect(read(POPUP)).toContain("distanceBandKm");
    expect(code).not.toContain("distanceMeters");
    expect(code).not.toContain("/ 1000");
    expect(code).not.toContain("latitude");
    expect(code).not.toContain("longitude");
  });

  it("does not render UUIDs or raw status enums as UI copy", () => {
    expect(code).not.toContain("{current.matchId}");
    expect(code).not.toContain("{current.bloodRequestId}");
    expect(code).not.toContain("{current.donorId}");
    expect(code).not.toContain(">ACCEPTED<");
    expect(code).not.toContain(">DONOR_ON_THE_WAY<");
    expect(code).not.toContain(">MATCHED<");
    expect(read(POPUP)).toContain("Accepted");
    expect(read(POPUP)).toContain("On the way");
  });

  it("does not fetch or show requester contact before or inside this popup", () => {
    expect(code).not.toContain("getAcceptedMatchContact");
    expect(code).not.toContain(".phone");
    expect(code).not.toContain("contactName");
    expect(read(POPUP)).toContain("Requester contact is shared only after you accept");
  });
});

describe("Phase 11D Step 2 — navigation and states", () => {
  const popup = read(POPUP);

  it("shows previous/next only when multiple actionable matches exist", () => {
    expect(popup).toContain("hasOthers");
    expect(popup).toContain("phase === \"actionable\" && hasOthers");
    expect(popup).toContain("Request {Math.min(index + 1, queue.length)} of {queue.length}");
    expect(popup).toContain("Previous");
    expect(popup).toContain("Next");
    expect(popup).toContain("index <= 0");
    expect(popup).toContain("index >= queue.length - 1");
  });

  it("covers accept success, on-the-way and error surfaces", () => {
    expect(popup).toContain('setPhase("accepted")');
    expect(popup).toContain('setPhase("on_the_way")');
    expect(popup).toContain("canMarkDonorOnTheWay");
    expect(popup).toContain('<Alert variant="success"');
    expect(popup).toContain('<Alert variant="danger"');
    expect(popup).toContain("{error}");
  });

  it("keeps 44px+ decision targets via Button size lg", () => {
    expect(popup).toContain('size="lg"');
    expect(read("src/components/ui/Button.tsx")).toContain('lg: "min-h-[52px]');
  });
});

describe("Phase 11D Step 2 — scope boundary", () => {
  it("does not redesign dashboard, profile, availability, requests or history", () => {
    // Dashboard still has its Step 1 heading; sibling pages stay on PageShell embedded.
    expect(read(DASHBOARD)).toContain("Your donor dashboard");
    expect(read("src/app/(donor)/donor/profile/page.tsx")).toContain("DonorProfileForm");
    expect(read("src/app/(donor)/donor/availability/page.tsx")).toContain("AvailabilitySelector");
    expect(read("src/app/(donor)/donor/requests/page.tsx")).toContain("DonorMatchActions");
    expect(read("src/app/(donor)/donor/history/page.tsx")).toContain("getDonationHistory");
  });

  it("adds no service or server-action imports beyond the existing donor actions", () => {
    const code = readCode(POPUP);
    expect(code).not.toContain("@/services/");
    expect(code).not.toContain('"use server"');
    expect(read(POPUP)).toContain('from "@/app/(donor)/actions"');
  });
});
