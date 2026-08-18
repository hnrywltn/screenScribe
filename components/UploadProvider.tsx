"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_SIZE_BYTES = 6 * 1024 * 1024 * 1024; // 6GB — headroom above the ~5GB real-world ceiling; matches the server-side check

function validate(file: File): string | null {
  if (!file.type.startsWith("video/")) return "Please choose a video file.";
  if (file.size > MAX_SIZE_BYTES) return "That file is too large — max 6GB for now.";
  return null;
}

type ActiveUpload = { filename: string; progress: number };

type UploadContextValue = {
  activeUpload: ActiveUpload | null;
  error: string | null;
  startUpload: (file: File) => void;
  cancelUpload: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUpload(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

// Mounted in app/(app)/layout.tsx, above {children} — that layout shell
// doesn't unmount when navigating within (app)/ (only children does),
// so an upload started from /upload keeps running, stays cancelable,
// and stays visible from /sessions even after navigating away from the
// page that started it. The XHR itself isn't tied to any one page.
export default function UploadProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startUpload = useCallback(
    (file: File) => {
      const validationError = validate(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setActiveUpload({ filename: file.name, progress: 0 });

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setActiveUpload({ filename: file.name, progress: Math.round((e.loaded / e.total) * 100) });
        }
      });
      xhr.addEventListener("load", () => {
        xhrRef.current = null;
        setActiveUpload(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          router.refresh();
        } else {
          let message = "Upload failed.";
          try {
            message = JSON.parse(xhr.responseText).error ?? message;
          } catch {
            // non-JSON error body, keep the generic message
          }
          setError(message);
        }
      });
      xhr.addEventListener("error", () => {
        xhrRef.current = null;
        setActiveUpload(null);
        setError("Upload failed — check your connection and try again.");
      });
      // Fires on xhr.abort() (cancelUpload below) — deliberately no
      // error message here, a user-initiated cancel isn't a failure.
      xhr.addEventListener("abort", () => {
        xhrRef.current = null;
        setActiveUpload(null);
      });
      xhr.open("POST", "/api/sessions");
      // Raw body, not multipart/form-data — the server streams this
      // straight to disk and on to B2 rather than buffering the whole
      // file in memory (which multipart parsing would require). The
      // filename travels as a header since there's no form field to
      // carry it; encodeURIComponent keeps it ASCII-safe for the header
      // value, decoded back to the real name server-side.
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
      xhr.send(file);

      // Send the user straight to the queue, where they can watch
      // progress and cancel — replaces the old "redirect once it
      // finishes" behavior, which could fire a surprise navigation
      // long after the user had moved on elsewhere.
      router.push("/sessions");
    },
    [router]
  );

  const cancelUpload = useCallback(() => {
    xhrRef.current?.abort();
  }, []);

  return (
    <UploadContext.Provider value={{ activeUpload, error, startUpload, cancelUpload }}>
      {children}
    </UploadContext.Provider>
  );
}
