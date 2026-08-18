"use client";

import { useUpload } from "./UploadProvider";

// Renders the client-only "in progress" state the server can't know
// about yet — see UploadProvider.tsx for why. Sits above the real,
// server-rendered session rows on the Sessions page; once the upload
// finishes, router.refresh() there swaps this out for the real
// DB-backed row automatically.
export default function ActiveUploadRow() {
  const { activeUpload, error, cancelUpload } = useUpload();

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 px-4 py-3">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!activeUpload) return null;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--color-text)] truncate">{activeUpload.filename}</p>
        <div className="mt-1.5 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden max-w-xs">
          <div
            className="h-full bg-[var(--color-sidebar)] transition-all"
            style={{ width: `${activeUpload.progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
          Uploading… {activeUpload.progress}%
        </span>
        <button
          onClick={cancelUpload}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
