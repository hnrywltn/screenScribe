import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Dev-only seed data — NOT for production. Gives a known set of
// credentials to log in with locally (via the real /login form) instead
// of signing up fresh every time the local DB gets reset. Safe to
// re-run: upserts on email, so it just resets the password each time.
const DEV_EMAIL = "dev@screenscribe.test";
const DEV_PASSWORD = "devpassword123";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [DEV_EMAIL, passwordHash]
  );

  console.log(`Seeded dev user — log in with:\n  email:    ${DEV_EMAIL}\n  password: ${DEV_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
