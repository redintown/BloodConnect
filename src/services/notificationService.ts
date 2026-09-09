import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors/AppError";
import { requireAuth } from "@/services/authService";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_KINDS,
  type NotificationChannel,
  type NotificationKind,
} from "@/lib/constants/verification";

export type { NotificationKind };

export interface NotificationPayload {
  recipientId: string;
  bloodRequestId?: string;
  matchId?: string;
  kind?: NotificationKind;
  title: string;
  body: string;
  /** Safe JSON-serializable request summary only. */
  data?: Record<string, unknown>;
}

export interface InAppNotification {
  id: string;
  recipientId: string;
  bloodRequestId: string | null;
  matchId: string | null;
  kind: NotificationKind | null;
  channel: NotificationChannel;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

const notifySchema = z.object({
  recipientId: z.string().uuid(),
  bloodRequestId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  kind: z.enum(NOTIFICATION_KINDS).optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(1000),
  data: z.record(z.unknown()).optional(),
});

export interface NotificationService {
  notify(payload: NotificationPayload, channel: NotificationChannel): Promise<string | null>;
  notifyBatch(payloads: NotificationPayload[], channel: NotificationChannel): Promise<number>;
  listForRecipient(userId: string, options?: { unreadOnly?: boolean }): Promise<InAppNotification[]>;
  markRead(notificationId: string, userId: string): Promise<void>;
}

function assertInAppChannel(channel: NotificationChannel): void {
  if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(channel)) {
    throw AppError.validation("Invalid notification channel");
  }
  if (channel !== "IN_APP") {
    throw AppError.validation("Only IN_APP notifications are supported in this phase.");
  }
}

function toDomain(row: {
  id: string;
  recipient_id: string;
  blood_request_id: string | null;
  match_id: string | null;
  kind: NotificationKind | null;
  channel: NotificationChannel;
  status: InAppNotification["status"];
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}): InAppNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    bloodRequestId: row.blood_request_id,
    matchId: row.match_id,
    kind: row.kind,
    channel: row.channel,
    status: row.status,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * Provider-agnostic notification abstraction.
 * Phase 6: IN_APP rows via service-role writes; SMS/email/WhatsApp not delivered.
 */
export const notificationService: NotificationService = {
  async notify(payload, channel) {
    assertInAppChannel(channel);

    const parsed = notifySchema.safeParse(payload);
    if (!parsed.success) {
      throw AppError.validation("Invalid notification payload");
    }

    const admin = createAdminClient();
    const body = {
      title: parsed.data.title,
      body: parsed.data.body,
      ...(parsed.data.data ?? {}),
    };

    // Idempotent: one row per recipient + request + kind when both are set.
    if (parsed.data.bloodRequestId && parsed.data.kind) {
      const { data: existing, error: existingError } = await admin
        .from("notifications")
        .select("id")
        .eq("recipient_id", parsed.data.recipientId)
        .eq("blood_request_id", parsed.data.bloodRequestId)
        .eq("kind", parsed.data.kind)
        .maybeSingle();

      if (existingError) throw AppError.server(existingError);
      if (existing) return (existing as { id: string }).id;
    }

    const { data, error } = await admin
      .from("notifications")
      .insert({
        recipient_id: parsed.data.recipientId,
        blood_request_id: parsed.data.bloodRequestId ?? null,
        match_id: parsed.data.matchId ?? null,
        kind: parsed.data.kind ?? null,
        channel: "IN_APP",
        status: "SENT",
        payload: body,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") return null;
      throw AppError.server(error);
    }

    return data?.id ?? null;
  },

  async notifyBatch(payloads, channel) {
    assertInAppChannel(channel);
    let created = 0;
    for (const payload of payloads) {
      const id = await notificationService.notify(payload, channel);
      if (id) created += 1;
    }
    return created;
  },

  async listForRecipient(userId, options) {
    const user = await requireAuth();
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");

    const supabase = createClient();
    let query = supabase
      .from("notifications")
      .select(
        "id, recipient_id, blood_request_id, match_id, kind, channel, status, payload, read_at, created_at"
      )
      .eq("recipient_id", userId)
      .eq("channel", "IN_APP")
      .order("created_at", { ascending: false });

    if (options?.unreadOnly) {
      query = query.is("read_at", null);
    }

    const { data, error } = await query;
    if (error) throw AppError.server(error);

    return ((data as Parameters<typeof toDomain>[0][] | null) ?? []).map(toDomain);
  },

  async markRead(notificationId, userId) {
    const user = await requireAuth();
    if (user.id !== userId) throw AppError.unauthorized("Unauthorized");
    if (!z.string().uuid().safeParse(notificationId).success) {
      throw AppError.validation("Invalid input");
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("mark_own_notification_read", {
      p_notification_id: notificationId,
    });
    if (error) {
      if (error.message?.includes("BC_NOT_FOUND")) {
        throw AppError.notFound("Notification not found.");
      }
      throw AppError.server(error);
    }
  },
};
