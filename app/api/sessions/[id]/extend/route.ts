export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { chargeTokens } from "@/lib/tokens";

const EXTEND_COST = 50;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // One atomic conditional UPDATE covers every ineligibility reason
    // (already extended, expired, wrong status, not the caller's
    // session) in a single check.
    const eligible = await client.query(
      `UPDATE sessions SET expires_at = expires_at + INTERVAL '1 hour', extended = TRUE, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'complete' AND extended = FALSE AND expires_at > NOW()
       RETURNING id`,
      [id, userId]
    );
    if (eligible.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This session can't be extended." }, { status: 400 });
    }

    const newBalance = await chargeTokens(client, userId, EXTEND_COST, "usage_extend", id);
    if (newBalance === null) {
      // Rolls back the expires_at bump too — nothing has committed yet.
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Not enough tokens to extend." }, { status: 400 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, newBalance });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
