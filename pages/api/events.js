import { eq, isNull } from "drizzle-orm";
import { getDb } from "../../connections/db";
import { event } from "../../db/event";
import { parseExcel } from "../../db/parse_excel";
import { country } from "../../db/country";

/** Ubah nilai jadi integer, atau null. */
function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/** Bersihkan nilai string agar tidak jadi string kosong/null. */
function cleanValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

/** Ubah nilai tanggal apa pun jadi string YYYY-MM-DD, atau null. */
function toDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;
  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    d = new Date(String(value).trim());
  }
  if (isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method === "POST") {
    return handlePost(req, res);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

async function handlePost(req, res) {
  const body = req.body;

  if (!Array.isArray(body?.events)) {
    return res
      .status(400)
      .json({ error: "Body harus berupa { events: [...] }" });
  }

  const db = getDb();

  try {
    const values = body.events.map((ev) => {
      const extendedProps = ev.extendedProps || {};
      return {
        event_id: cleanValue(ev.id),
        parse_excel_id: toInt(extendedProps.parse_excel_id),
        title: cleanValue(ev.title),
        start_date: toDateOnly(ev.start),
        all_day: ev.allDay ?? true,
        background_color: cleanValue(ev.backgroundColor),
        border_color: cleanValue(ev.borderColor),
        nama: cleanValue(extendedProps.nama),
        no_paspor: cleanValue(extendedProps.no_paspor),
        jenis_visa: cleanValue(extendedProps.jenis_visa),
        stage: cleanValue(extendedProps.stage),
        warnings: Array.isArray(extendedProps.warnings)
          ? extendedProps.warnings
          : null,
      };
    });

    if (values.length === 0) {
      return res.status(200).json({ inserted: 0 });
    }

    const result = await db.insert(event).values(values).returning({
      id: event.id,
    });
    return res.status(200).json({ inserted: result.length });
  } catch (err) {
    console.error("Gagal menyimpan event ke PostgreSQL:", err);
    return res.status(500).json({ error: "Gagal menyimpan event ke database" });
  }
}

/** Ambil semua event (belum dihapus) + data parse_excel terkait (negara, dll). */
async function handleGet(_req, res) {
  const db = getDb();
  try {
    const rows = await db
      .select({
        event: event,
        negara: country.name,
        waktu_proses_kedutaan: parseExcel.waktu_proses_kedutaan,
      })
      .from(event)
      .leftJoin(parseExcel, eq(event.parse_excel_id, parseExcel.id))
      .leftJoin(country, eq(parseExcel.country_id, country.id))
      .where(isNull(event.deleted_at))
      .orderBy(event.start_date, event.id);

    const events = rows.map(({ event: ev, negara, waktu_proses_kedutaan }) => ({
      ...ev,
      negara,
      waktu_proses_kedutaan: waktu_proses_kedutaan || null,
    }));
    return res.status(200).json({ events });
  } catch (err) {
    console.error("Gagal mengambil event dari PostgreSQL:", err);
    return res
      .status(500)
      .json({ error: "Gagal mengambil event dari database" });
  }
}
