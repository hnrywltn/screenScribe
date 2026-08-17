export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";
import pool from "@/lib/db";
import { TOKEN_PACKS, TokenPackId } from "@/lib/tokenPacks";
import TokenPacksSection from "@/components/billing/TokenPacksSection";
import SubscribeButton from "@/components/billing/SubscribeButton";
import CancelSubscriptionButton from "@/components/billing/CancelSubscriptionButton";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export default async function BillingPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login"); // (app)/layout.tsx already gates this — defensive

  const { rows } = await pool.query<{
    token_balance: number;
    stripe_subscription_status: string | null;
    stripe_cancel_at_period_end: boolean;
  }>(
    `SELECT token_balance, stripe_subscription_status, stripe_cancel_at_period_end FROM users WHERE id = $1`,
    [userId]
  );
  const { token_balance, stripe_subscription_status, stripe_cancel_at_period_end } = rows[0];
  const isSubscribed = stripe_subscription_status ? ACTIVE_STATUSES.includes(stripe_subscription_status) : false;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">Billing</h1>
      <p className="text-sm text-[var(--color-muted)] mt-1">Test-mode Stripe checkout — no real charges.</p>

      <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Token balance</p>
        <p className="mt-1 text-3xl font-semibold text-[var(--color-text)]">{token_balance} tokens</p>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <h2 className="font-medium text-[var(--color-text)]">Subscription</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">$15/month — 100 tokens included every month.</p>

        <div className="mt-4">
          {isSubscribed ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text)]">
                {stripe_cancel_at_period_end ? "Cancels at the end of the current period" : "Active"}
              </span>
              {!stripe_cancel_at_period_end && <CancelSubscriptionButton />}
            </div>
          ) : (
            <SubscribeButton />
          )}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <h2 className="font-medium text-[var(--color-text)]">Buy tokens</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">$0.20/token, one-time purchase.</p>

        <div className="mt-4">
          <TokenPacksSection
            packs={(Object.entries(TOKEN_PACKS) as [TokenPackId, (typeof TOKEN_PACKS)[TokenPackId]][]).map(
              ([packId, pack]) => ({ packId, label: pack.label, amountCents: pack.amountCents })
            )}
          />
        </div>
      </div>
    </div>
  );
}
