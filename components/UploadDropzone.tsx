"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB — arbitrary but generous for a lecture recording

function validate(file: File): string | null {
  if (!file.type.startsWith("video/")) return "Please choose a video file.";
  if (file.size > MAX_SIZE_BYTES) return "That file is too large — max 2GB for now.";
  return null;
}

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    (file: File) => {
      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setProgress(0);

      const formData = new FormData();
      formData.append("video", file);

      // XMLHttpRequest, not fetch — fetch has no upload-progress event,
      // and a multi-hundred-MB video is exactly the case where a bare
      // spinner isn't good enough feedback.
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          router.push("/sessions");
          router.refresh();
        } else {
          let message = "Upload failed.";
          try {
            message = JSON.parse(xhr.responseText).error ?? message;
          } catch {
            // non-JSON error body, keep the generic message
          }
          setError(message);
          setProgress(null);
        }
      });
      xhr.addEventListener("error", () => {
        setError("Upload failed — check your connection and try again.");
        setProgress(null);
      });
      xhr.open("POST", "/api/sessions");
      xhr.send(formData);
    },
    [router]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging ? "border-[var(--color-accent-hover)] bg-white" : "border-[var(--color-border)] bg-white/50"
        }`}
      >
        <Upload className="w-8 h-8 mx-auto text-[var(--color-muted)] mb-3" />
        <p className="text-sm font-medium text-[var(--color-text)]">Drag and drop a video, or click to browse</p>
        <p className="text-xs text-[var(--color-muted)] mt-1">Up to 2GB</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {progress !== null && (
        <div className="mt-4">
          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-sidebar)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1 text-center">Uploading… {progress}%</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}
