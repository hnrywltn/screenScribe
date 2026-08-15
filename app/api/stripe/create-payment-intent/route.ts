export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import stripe, { getOrCreateStripeCustomer } from "@/lib/stripe";
import { TOKEN_PACKS, TokenPackId } from "@/lib/tokenPacks";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json();
  const packId = typeof body.packId === "string" ? (body.packId as TokenPackId) : undefined;
  const pack = packId ? TOKEN_PACKS[packId] : undefined;
  if (!pack) {
    return NextResponse.json({ error: "Invalid pack." }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer(userId);

  // Amount and token count both come from our own server-side config,
  // never from the client — the client only ever sends an opaque
  // packId.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pack.amountCents,
    currency: "usd",
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      userId,
      packId: packId!,
      tokens: String(pack.tokens),
      source: "token_pack",
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
