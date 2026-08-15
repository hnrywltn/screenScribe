export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";

export async function POST(request: Request) {
  const adminId = await getCurrentUserId();
  if (!adminId) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { rows: adminRows } = await pool.query<{ is_admin: boolean }>(`SELECT is_admin FROM users WHERE id = $1`, [
    adminId,
  ]);
  if (!adminRows[0]?.is_admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await request.json();
  const targetUserId = typeof body.userId === "string" ? body.userId : "";
  const tokens = Number(body.tokens);

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }
  if (!Number.isInteger(tokens) || tokens <= 0) {
    return NextResponse.json({ error: "tokens must be a positive integer." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO token_grants (user_id, tokens, amount_cents, source) VALUES ($1, $2, NULL, 'admin_grant')`,
      [targetUserId, tokens]
    );

    const { rows } = await client.query<{ token_balance: number }>(
      `UPDATE users SET token_balance = token_balance + $2 WHERE id = $1 RETURNING token_balance`,
      [targetUserId, tokens]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, newBalance: rows[0].token_balance });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
