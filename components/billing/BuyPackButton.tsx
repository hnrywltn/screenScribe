"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StripeElementsProvider from "./StripeElementsProvider";
import CheckoutForm from "./CheckoutForm";
import type { TokenPackId } from "@/lib/tokenPacks";

export default function BuyPackButton({ packId, label }: { packId: TokenPackId; label: string }) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not start checkout.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setClientSecret(data.clientSecret);
    setLoading(false);
  }

  function handleSuccess() {
    setClientSecret(null);
    // The webhook grants tokens asynchronously — give it a moment
    // before refreshing the server-rendered balance.
    setTimeout(() => router.refresh(), 1200);
  }

  if (clientSecret) {
    return (
      <StripeElementsProvider clientSecret={clientSecret}>
        <CheckoutForm onSuccess={handleSuccess} onCancel={() => setClientSecret(null)} />
      </StripeElementsProvider>
    );
  }

  return (
    <div>
      <button
        onClick={startCheckout}
        disabled={loading}
        className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {loading ? "…" : `Buy ${label}`}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
