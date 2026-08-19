import { getDb } from "../../connections/db";
import { parseExcel } from "../../db/schema";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body;

  if (!Array.isArray(body?.rows)) {
    return res.status(400).json({ error: "Body harus berupa { rows: [...] }" });
  }

  const rowsToInsert = body.rows.map((r) => {
    const cleaned = {
      nama: cleanValue(r?.nama),
      no_paspor: cleanValue(r?.no_paspor),
      pic: cleanValue(r?.pic),
      jenis_visa: cleanValue(r?.jenis_visa),
      negara: cleanValue(r?.negara),
      waktu_proses_kedutaan: toInt(r?.waktu_proses_kedutaan),
      waktu_proses_wepose: toInt(r?.waktu_proses_wepose),
    };
    cleaned.tanggal_keberangkatan = toDateOnly(r?.tanggal_keberangkatan);
    cleaned.appointment = toDateOnly(r?.appointment);
    return cleaned;
  });

  if (rowsToInsert.length === 0) {
    return res.status(200).json({ inserted: 0 });
  }

  const db = getDb();

  try {
    const result = await db.insert(parseExcel).values(rowsToInsert).returning({
      id: parseExcel.id,
    });
    return res.status(200).json({ inserted: result.length });
  } catch (err) {
    console.error("Gagal menyimpan ke PostgreSQL:", err);
    return res.status(500).json({ error: "Gagal menyimpan ke database" });
  }
}
