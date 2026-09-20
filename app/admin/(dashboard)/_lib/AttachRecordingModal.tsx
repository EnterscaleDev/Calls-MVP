"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { InlineBanner } from "@/components/ui/States";

/** SMSala's recording product has no API — recordings are downloaded by hand
 * from their dashboard as .wav files. This is the manual counterpart: an
 * admin who has already downloaded a file attaches it here, which uploads it
 * to Supabase Storage and writes the real `recordings` row the rest of the
 * app (the Recording column, badges, etc.) already expects. */
export function AttachRecordingModal({
  open,
  onClose,
  campaignId,
  callAttemptId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  callAttemptId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setFile(null);
    setError("");
    setUploading(false);
  }

  function handleClose() {
    if (uploading) return;
    reset();
    onClose();
  }

  function readDurationSeconds(f: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      const audio = document.createElement("audio");
      const url = URL.createObjectURL(f);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      audio.src = url;
    });
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const duration = await readDurationSeconds(file);
      const extension = file.name.split(".").pop() || "wav";
      const path = `${campaignId}/${callAttemptId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("call-recordings")
        .upload(path, file, { contentType: file.type || "audio/wav" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("recordings").insert({
        campaign_id: campaignId,
        call_attempt_id: callAttemptId,
        provider_recording_id: `manual-${crypto.randomUUID()}`,
        storage_reference: path,
        status: "available",
        duration,
      });
      if (insertError) throw insertError;

      await supabase.rpc("admin_log_recording_uploaded", {
        p_campaign_id: campaignId,
        p_call_attempt_id: callAttemptId,
      });

      reset();
      onClose();
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong uploading this recording.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Attach call recording"
      description="Downloaded manually from SMSala's recording dashboard — there's no API for this yet, so this is a one-off upload per call."
    >
      <div className="flex flex-col gap-4">
        {error ? <InlineBanner kind="danger">{error}</InlineBanner> : null}
        <input
          type="file"
          accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/m4a,audio/mp4"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
          className="text-sm text-foreground-muted file:mr-3 file:rounded-[5px] file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Attach recording"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
