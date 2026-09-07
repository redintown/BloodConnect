import "server-only";
import { AppError } from "@/lib/errors/AppError";
import { createAdminClient } from "@/lib/supabase/server";
import { recordDonationSchema, type RecordDonationInput } from "@/schemas/donation.schema";
import type { DonationRecord } from "@/types/domain";

/**
 * Owns writes to donations. Reads for the owning donor stay on donorService.
 * No authenticated INSERT policy — all inserts go through the service-role client.
 */

export interface DonationService {
  recordDonation(input: RecordDonationInput): Promise<DonationRecord>;
}

export const donationService: DonationService = {
  async recordDonation(input) {
    const parsed = recordDonationSchema.safeParse(input);
    if (!parsed.success) {
      throw AppError.validation("Invalid input");
    }

    const admin = createAdminClient();
    const {
      donorId,
      bloodRequestId,
      bloodRequestMatchId,
      donatedAt,
      quantityMl,
      notes,
    } = parsed.data;

    const { data: match, error: matchError } = await admin
      .from("blood_request_matches")
      .select("id, donor_id, blood_request_id, status")
      .eq("id", bloodRequestMatchId)
      .maybeSingle();

    if (matchError) throw AppError.server(matchError);
    if (!match) throw AppError.notFound("Match not found.");

    const matchRow = match as {
      id: string;
      donor_id: string;
      blood_request_id: string;
      status: string;
    };

    if (matchRow.donor_id !== donorId) {
      throw AppError.unauthorized("Donation donor does not match the accepted match.");
    }
    if (matchRow.blood_request_id !== bloodRequestId) {
      throw AppError.conflict("Donation request does not match the accepted match.");
    }
    if (matchRow.status !== "ACCEPTED") {
      throw AppError.conflict("Donations can only be recorded for an accepted match.");
    }

    const { data: existing, error: existingError } = await admin
      .from("donations")
      .select("id")
      .eq("donor_id", donorId)
      .eq("blood_request_id", bloodRequestId)
      .maybeSingle();

    if (existingError) throw AppError.server(existingError);
    if (existing) {
      throw AppError.conflict("A donation has already been recorded for this request.");
    }

    const { data, error } = await admin
      .from("donations")
      .insert({
        donor_id: donorId,
        blood_request_id: bloodRequestId,
        blood_request_match_id: bloodRequestMatchId,
        donated_at: donatedAt ?? new Date().toISOString(),
        quantity_ml: quantityMl ?? null,
        notes: notes ?? null,
      })
      .select("id, donated_at, quantity_ml, notes")
      .single();

    if (error) {
      // Unique index race: treat as conflict.
      if (error.code === "23505") {
        throw AppError.conflict("A donation has already been recorded for this request.");
      }
      throw AppError.server(error);
    }

    const row = data as {
      id: string;
      donated_at: string;
      quantity_ml: number | null;
      notes: string | null;
    };

    return {
      id: row.id,
      donatedAt: row.donated_at,
      quantityMl: row.quantity_ml,
      notes: row.notes,
    };
  },
};
