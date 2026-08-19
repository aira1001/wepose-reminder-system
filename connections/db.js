import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

const connectionString = process.env.DATABASE_URL;

let pool;
let db;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/**
 * Eksekusi query SQL mentah. Dipakai untuk migrasi & pengecekan koneksi.
 * Setiap panggilan dapat koneksi sendiri (tidak di-cache antar request API).
 */
export async function query(text, params = []) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
