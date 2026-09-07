import "server-only";
import { NotImplementedError } from "@/lib/errors/AppError";
import type { NotificationChannel } from "@/lib/constants/verification";

export interface NotificationPayload {
  recipientId: string;
  bloodRequestId?: string;
  title: string;
  body: string;
}

/**
 * Provider-agnostic notification abstraction (Section 9 of the brief).
 * Each channel gets its own adapter behind this single interface so the
 * app never calls a vendor SDK directly — swapping e.g. Twilio for another
 * SMS provider should mean touching one adapter file, not every call site.
 */
export interface NotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
}

export interface NotificationService {
  /** Sends via the given channel, recording the attempt in `notifications`. */
  notify(payload: NotificationPayload, channel: NotificationChannel): Promise<void>;
  /** Notifies a ranked batch, respecting "don't blast every donor at once". */
  notifyBatch(payloads: NotificationPayload[], channel: NotificationChannel): Promise<void>;
}

export const notificationService: NotificationService = {
  async notify() {
    throw new NotImplementedError("notificationService.notify");
  },
  async notifyBatch() {
    throw new NotImplementedError("notificationService.notifyBatch");
  },
};
