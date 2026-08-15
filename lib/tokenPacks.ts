export type TokenPackId = "pack_25" | "pack_50" | "pack_100" | "pack_250";

// Single source of truth for pack pricing — imported by both the
// billing page (display) and create-payment-intent (the actual charge
// amount). The client only ever sends a packId; the server looks up the
// real amount itself, never trusts a client-sent dollar figure.
export const TOKEN_PACKS: Record<TokenPackId, { tokens: number; amountCents: number; label: string }> = {
  pack_25: { tokens: 25, amountCents: 500, label: "25 tokens" },
  pack_50: { tokens: 50, amountCents: 1000, label: "50 tokens" },
  pack_100: { tokens: 100, amountCents: 2000, label: "100 tokens" },
  pack_250: { tokens: 250, amountCents: 5000, label: "250 tokens" },
};

// Matches the $15/mo subscription price on the marketing page.
export const SUBSCRIPTION_TOKENS_PER_MONTH = 100;
