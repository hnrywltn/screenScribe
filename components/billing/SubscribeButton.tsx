"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StripeElementsProvider from "./StripeElementsProvider";
import CheckoutForm from "./CheckoutForm";

export default function SubscribeButton() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/create-subscription", { method: "POST" });
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
        className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-sidebar)] text-white hover:bg-[var(--color-sidebar-hover)] transition-colors disabled:opacity-60"
      >
        {loading ? "…" : "Subscribe — $15/mo"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
