"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StripeElementsProvider from "./StripeElementsProvider";
import CheckoutForm from "./CheckoutForm";
import type { TokenPackId } from "@/lib/tokenPacks";

type Pack = { packId: TokenPackId; label: string; amountCents: number };

// State lives here, not per-card, so an active checkout can render
// full-width below the grid instead of being squeezed into whichever
// narrow grid cell the "Buy" button happened to live in.
export default function TokenPacksSection({ packs }: { packs: Pack[] }) {
  const router = useRouter();
  const [selectedPackId, setSelectedPackId] = useState<TokenPackId | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingPackId, setLoadingPackId] = useState<TokenPackId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(packId: TokenPackId) {
    setLoadingPackId(packId);
    setError(null);
    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start checkout.");
      setLoadingPackId(null);
      return;
    }
    const data = await res.json();
    setSelectedPackId(packId);
    setClientSecret(data.clientSecret);
    setLoadingPackId(null);
  }

  function reset() {
    setSelectedPackId(null);
    setClientSecret(null);
  }

  function handleSuccess() {
    reset();
    // The webhook grants tokens asynchronously — give it a moment before
    // refreshing the server-rendered balance.
    setTimeout(() => router.refresh(), 1200);
  }

  const selectedPack = selectedPackId ? packs.find((p) => p.packId === selectedPackId) : null;

  if (selectedPack && clientSecret) {
    return (
      <div>
        <p className="text-sm text-[var(--color-text)]">
          {selectedPack.label} — ${(selectedPack.amountCents / 100).toFixed(2)}
        </p>
        <StripeElementsProvider clientSecret={clientSecret}>
          <CheckoutForm onSuccess={handleSuccess} onCancel={reset} />
        </StripeElementsProvider>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {packs.map((pack) => (
          <div key={pack.packId} className="border border-[var(--color-border)] rounded-xl p-4 text-center">
            <p className="font-medium text-[var(--color-text)]">{pack.label}</p>
            <p className="text-sm text-[var(--color-muted)]">${(pack.amountCents / 100).toFixed(2)}</p>
            <div className="mt-3">
              <button
                onClick={() => startCheckout(pack.packId)}
                disabled={loadingPackId !== null}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
              >
                {loadingPackId === pack.packId ? "…" : `Buy ${pack.label}`}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
