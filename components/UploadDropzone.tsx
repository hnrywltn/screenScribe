"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { useUpload } from "./UploadProvider";

export default function UploadDropzone() {
  const { activeUpload, error, startUpload } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) startUpload(file);
  }

  // startUpload() itself navigates to /sessions, so this mostly guards
  // against briefly re-rendering the dropzone before that navigation
  // lands.
  if (activeUpload) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] p-12 text-center">
        <p className="text-sm font-medium text-[var(--color-text)]">Uploading {activeUpload.filename}…</p>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          Watch progress (and cancel if needed) from{" "}
          <Link href="/sessions" className="underline">
            Sessions
          </Link>
          .
        </p>
      </div>
    );
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
            if (file) startUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}
