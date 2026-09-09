import type { BloodBank } from "@/types/domain";

/**
 * @deprecated Unused since Phase 8 — see the note on `HospitalCard`. Folds
 * into a single `OrganizationCard` in Phase 11F.
 */
export function BloodBankCard({ bloodBank }: { bloodBank: BloodBank }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="font-medium text-gray-800">{bloodBank.name}</p>
      <p className="text-sm text-gray-500">{bloodBank.address}</p>
      {bloodBank.emergencyHours && (
        <p className="mt-1 text-xs text-gray-500">Emergency hours: {bloodBank.emergencyHours}</p>
      )}
    </div>
  );
}
