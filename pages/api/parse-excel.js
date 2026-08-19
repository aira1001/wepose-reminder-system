import { eq } from "drizzle-orm";
import { getDb } from "../../connections/db";
import { parseExcel } from "../../db/parse_excel";
import { country } from "../../db/country";

/** Bersihkan nilai string agar tidak jadi string kosong/null yang aneh di DB. */
function cleanValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

/** Ubah nilai tanggal apa pun (Date / string / Excel serial) jadi string YYYY-MM-DD, atau null. */
function toDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;
  let d;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number") {
    const excelEpochUTC = Date.UTC(1899, 11, 30);
    const utcInstant = new Date(excelEpochUTC + Math.round(value) * 86400000);
    d = new Date(
      utcInstant.getUTCFullYear(),
      utcInstant.getUTCMonth(),
      utcInstant.getUTCDate(),
    );
  } else {
    d = new Date(String(value).trim());
  }
  if (isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ubah nilai durasi (angka / "14 hari") jadi integer hari, atau null. */
function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pastikan semua negara (berdasarkan nama) ada di tabel country.
 * - Sudah ada  -> pakai id-nya (tidak membuat duplikat).
 * - Belum ada  -> insert baru, ambil id.
 * Return: Map nama negara (normalized) -> country_id.
 */
async function upsertCountries(db, names) {
  const uniqueNames = Array.from(
    new Set(names.map((n) => cleanValue(n)).filter(Boolean)),
  );
  const idByName = new Map();

  for (const name of uniqueNames) {
    // Cek dulu apakah nama sudah ada (validasi: jangan create kalau sudah ada)
    const existing = await db
      .select({ id: country.id })
      .from(country)
      .where(eq(country.name, name))
      .limit(1);

    if (existing.length > 0) {
      idByName.set(name, existing[0].id);
      continue;
    }

    const inserted = await db
      .insert(country)
      .values({ name })
      .returning({ id: country.id });
    idByName.set(name, inserted[0].id);
  }

  return idByName;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body;

  if (!Array.isArray(body?.rows)) {
    return res.status(400).json({ error: "Body harus berupa { rows: [...] }" });
  }

  const db = getDb();

  try {
    // 1) Upsert semua negara unik -> country_id (auto-create, tanpa duplikat)
    const idByName = await upsertCountries(
      db,
      body.rows.map((r) => r?.negara),
    );

    // 2) Normalisasi baris sesuai kolom parse_excel
    const rowsToInsert = body.rows.map((r) => {
      const negara = cleanValue(r?.negara);
      const cleaned = {
        nama: cleanValue(r?.nama),
        no_paspor: cleanValue(r?.no_paspor),
        pic: cleanValue(r?.pic),
        country_id: negara ? idByName.get(negara) : null,
        jenis_visa: cleanValue(r?.jenis_visa),
        waktu_proses_kedutaan: toInt(r?.waktu_proses_kedutaan),
        waktu_proses_wepose: toInt(r?.waktu_proses_wepose),
      };
      cleaned.tanggal_keberangkatan = toDateOnly(r?.tanggal_keberangkatan);
      cleaned.appointment = toDateOnly(r?.appointment_date);
      return cleaned;
    });

    if (rowsToInsert.length === 0) {
      return res.status(200).json({ inserted: 0, ids: [] });
    }

    const result = await db.insert(parseExcel).values(rowsToInsert).returning({
      id: parseExcel.id,
    });

    const ids = result.map((r) => r.id);
    return res.status(200).json({ inserted: result.length, ids });
  } catch (err) {
    console.error("Gagal menyimpan ke PostgreSQL:", err);
    return res.status(500).json({ error: "Gagal menyimpan ke database" });
  }
}
