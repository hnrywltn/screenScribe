// Self-contained env loading — don't assume whoever imports this module
// has already loaded .env.local. ES module imports are hoisted, so if
// index.ts's dotenv.config() call ran *after* this import in program
// order, it would actually run *before* this module's top-level code
// either way — the Pool would get constructed with DATABASE_URL still
// undefined. (Exactly what happened: pg silently fell back to a default
// connection using the OS username as the database name.)
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
