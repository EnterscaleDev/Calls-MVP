/**
 * Telephony provider adapter boundary.
 *
 * MOCKED: no real telephony/click-to-call provider is configured in this
 * environment. In a real backend this whole module runs server-side only —
 * it is the one place allowed to see a participant's raw phone number, and
 * the browser never receives it. Here (frontend-only mock phase) call sites
 * still only pass an assignmentId, never a phone number, to mirror that
 * boundary even though there is no real server yet.
 */

export type CallProgressEvent =
  | "preparing"
  | "connecting"
  | "connected"
  | "failed"
  | "ended";

export interface InitiateMaskedCallResult {
  providerCallId: string;
}

export interface TelephonyProvider {
  /** Server-side-only in the real system: resolves assignment -> phone, then bridges the call. */
  initiateMaskedCall(
    assignmentId: string,
    onProgress: (event: CallProgressEvent) => void
  ): Promise<InitiateMaskedCallResult>;
  requestRecording(providerCallId: string): Promise<{ providerRecordingId: string }>;
}

class MockTelephonyProvider {
  async initiateMaskedCall(
    assignmentId: string,
    onProgress: (event: CallProgressEvent) => void
  ): Promise<InitiateMaskedCallResult> {
    const providerCallId = `mock_call_${Math.random().toString(36).slice(2, 10)}`;
    onProgress("preparing");
    await delay(500);
    onProgress("connecting");
    await delay(1200);

    const connects = Math.random() > 0.08;
    if (!connects) {
      onProgress("failed");
      return { providerCallId };
    }

    onProgress("connected");
    return { providerCallId };
  }

  async requestRecording(providerCallId: string): Promise<{ providerRecordingId: string }> {
    await delay(300);
    return { providerRecordingId: `mock_rec_${providerCallId.slice(-8)}` };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockTelephonyProvider = new MockTelephonyProvider();
