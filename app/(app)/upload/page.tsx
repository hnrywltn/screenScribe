import UploadDropzone from "@/components/UploadDropzone";

export default function UploadPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">New Session</h1>
      <p className="text-sm text-[var(--color-muted)] mt-2 mb-6">
        Upload a recorded presentation or screen share. We&apos;ll email you when it&apos;s ready — downloads stay
        available for 1 hour.
      </p>
      <UploadDropzone />
    </div>
  );
}
