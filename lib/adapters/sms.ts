/**
 * SMS provider adapter boundary.
 *
 * MOCKED: no real SMS provider is configured in this environment. This file
 * defines the interface the rest of the app talks to; only this file knows
 * about "provider" concepts. Swap `mockSmsProvider` for a real Twilio/etc.
 * adapter later without touching call sites.
 */

export interface SendSmsInput {
  to: string;
  body: string;
  senderId: string;
}

export interface SendSmsResult {
  providerMessageId: string;
  status: "queued" | "failed";
  failureReason?: string;
}

export type SmsDeliveryStatus = "queued" | "sent" | "delivered" | "failed";

export interface SmsProvider {
  sendSMS(input: SendSmsInput): Promise<SendSmsResult>;
  getSMSStatus(providerMessageId: string): Promise<SmsDeliveryStatus>;
}

/**
 * Simulates real-world SMS sending: a small fraction of sends fail outright
 * (bad number, carrier rejection) and the rest queue up for async delivery.
 */
class MockSmsProvider implements SmsProvider {
  private statuses = new Map<string, SmsDeliveryStatus>();

  async sendSMS(input: SendSmsInput): Promise<SendSmsResult> {
    await delay(120);
    const providerMessageId = `mock_sms_${Math.random().toString(36).slice(2, 10)}`;

    const looksInvalid = !/^\+?[0-9\s()-]{7,}$/.test(input.to);
    if (looksInvalid || Math.random() < 0.04) {
      this.statuses.set(providerMessageId, "failed");
      return {
        providerMessageId,
        status: "failed",
        failureReason: looksInvalid ? "Invalid destination number" : "Carrier rejected message",
      };
    }

    this.statuses.set(providerMessageId, "queued");
    // Simulate async delivery a little later.
    setTimeout(() => {
      this.statuses.set(providerMessageId, "sent");
      setTimeout(() => {
        const delivered = Math.random() > 0.06;
        this.statuses.set(providerMessageId, delivered ? "delivered" : "failed");
      }, 800 + Math.random() * 1200);
    }, 400 + Math.random() * 600);

    return { providerMessageId, status: "queued" };
  }

  async getSMSStatus(providerMessageId: string): Promise<SmsDeliveryStatus> {
    return this.statuses.get(providerMessageId) ?? "queued";
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockSmsProvider: SmsProvider = new MockSmsProvider();

export function estimateSegments(body: string): number {
  const gsm7 = /^[\x00-\x7F£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#$%&'()*+,\-./0-9:;<=>?A-Z¡ÄÖÑÜ§¿a-zäöñüà]*$/.test(
    body
  );
  const singleLimit = gsm7 ? 160 : 70;
  const multiLimit = gsm7 ? 153 : 67;
  if (body.length === 0) return 0;
  if (body.length <= singleLimit) return 1;
  return Math.ceil(body.length / multiLimit);
}
