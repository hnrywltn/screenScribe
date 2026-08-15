import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import pool from "./db";

const SESSION_COOKIE = "screenscribe_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const VERIFICATION_MAX_AGE = "24h";
// Shorter than verification's 24h — a reset link is realistically
// clicked within minutes if legitimate, and unlike replaying a
// verification link (harmless/idempotent), replaying a password-reset
// link isn't. A short window shrinks that exposure at zero added
// complexity.
const PASSWORD_RESET_MAX_AGE = "30m";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Only callable from a Route Handler or Server Function — Next.js
// disallows setting cookies during Server Component rendering.
export async function createSession(userId: string): Promise<void> {
  // `purpose` is checked on the way back out (getCurrentUserId) so a
  // verification-link token (below) can never be replayed as a login
  // session, or vice versa — both are signed with the same secret,
  // purpose-scoping is the only thing keeping them from being
  // interchangeable.
  const token = await new SignJWT({ userId, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Safe to call from Server Components (read-only) as well as Route
// Handlers. Returns null for a missing, expired, or tampered cookie
// rather than throwing — callers treat "no session" and "bad session"
// the same way.
//
// Also checked LIVE against the DB, not just the JWT's signature: a
// paused/revoked account's session token is still cryptographically
// valid until it expires (30 days), so trusting the token alone would
// mean pausing/revoking someone only takes effect once they happen to
// log out or their session naturally expires — not what "pause" or
// "revoke" should mean. Querying account_status on every call is what
// makes it take effect on their very next request instead. Every
// protected route already calls this function, so the enforcement is
// automatic everywhere rather than something each route has to
// remember to add separately.
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "session") return null;
    if (typeof payload.userId !== "string") return null;
    userId = payload.userId;
  } catch {
    return null;
  }

  const { rows } = await pool.query<{ account_status: string }>(
    `SELECT account_status FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0 || rows[0].account_status !== "active") return null;

  return userId;
}

// Verification tokens are short-lived JWTs, not stored server-side —
// there's nothing to look up, the signature + purpose + expiry check
// alone is the proof of email ownership.
export async function createVerificationToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: "email-verification" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(VERIFICATION_MAX_AGE)
    .sign(secretKey());
}

export async function verifyVerificationToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "email-verification") return null;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

// Same shape as the verification token above — no DB token table, the
// signature + purpose + expiry alone is the proof. Known, accepted
// trade-off: there's no server-side single-use tracking, so a token
// remains valid (replayable) for its full window even after being used
// once — same trade-off already accepted for email verification, kept
// consistent rather than introducing a used-tokens table here alone.
export async function createPasswordResetToken(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: "password-reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(PASSWORD_RESET_MAX_AGE)
    .sign(secretKey());
}

export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== "password-reset") return null;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
