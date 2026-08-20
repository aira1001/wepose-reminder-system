import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb, query } from "../../connections/db";
import { country } from "../../db/country";
import { event } from "../../db/event";
import { parseExcel } from "../../db/parse_excel";
import { buildCalendarEvents } from "../../lib/calendarEvents";
import { calculateAll, DEFAULT_CONFIG } from "../../lib/dateCalc";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCountryName(value) {
  return String(value || "").trim();
}

function normalizeHolidayList(dates) {
  if (!Array.isArray(dates)) return [];
  const cleaned = dates
    .map((d) => String(d || "").trim())
    .filter((d) => YMD_RE.test(d));
  return Array.from(new Set(cleaned)).sort();
}

function parseHolidayDatesJson(rawValue) {
  if (!rawValue) return [];
  try {
    return normalizeHolidayList(JSON.parse(String(rawValue)));
  } catch {
    return [];
  }
}

function normalizeHolidaysByCountry(input) {
  const normalized = {};
  Object.entries(input || {}).forEach(([rawCountry, rawDates]) => {
    const countryName = normalizeCountryName(rawCountry);
    if (!countryName) return;
    normalized[countryName] = normalizeHolidayList(rawDates);
  });
  return normalized;
}

function cleanValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toDateOnly(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  return YMD_RE.test(text) ? text : null;
}

function toEventDbRow(ev) {
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
}

function toTimelineRows(rows) {
  return rows.map((r) => ({
    parse_excel_id: r.id,
    nama: r.nama,
    no_paspor: r.no_paspor,
    jenis_visa: r.jenis_visa,
    negara: r.negara,
    tanggal_keberangkatan: r.tanggal_keberangkatan,
    appointment_date: r.appointment,
    waktu_proses_kedutaan: r.waktu_proses_kedutaan,
    waktu_proses_wepose: r.waktu_proses_wepose,
  }));
}

async function loadHolidayMap(db) {
  const result = await query(
    "SELECT name, COALESCE(holiday_dates_json, '[]') AS holiday_dates_json FROM country",
  );
  const rows = result.rows || [];

  const holidaysByCountry = {};
  rows.forEach((row) => {
    const name = normalizeCountryName(row.name);
    if (!name) return;
    holidaysByCountry[name] = parseHolidayDatesJson(row.holiday_dates_json);
  });
  return holidaysByCountry;
}

async function handleGet(_req, res) {
  try {
    const db = getDb();
    const holidaysByCountry = await loadHolidayMap(db);
    return res.status(200).json({ holidaysByCountry });
  } catch (err) {
    console.error("Gagal mengambil holiday negara:", err);
    return res
      .status(500)
      .json({ error: "Gagal mengambil holiday negara dari database" });
  }
}

async function handlePost(req, res) {
  const body = req.body || {};
  if (!body.holidaysByCountry || typeof body.holidaysByCountry !== "object") {
    return res
      .status(400)
      .json({ error: "Body harus berisi holidaysByCountry" });
  }

  const db = getDb();
  const normalizedMap = normalizeHolidaysByCountry(body.holidaysByCountry);
  const allCountriesFromPayload = Object.keys(normalizedMap);

  try {
    const existingCountriesResult = await query("SELECT id, name FROM country");
    const existingCountries = existingCountriesResult.rows || [];

    const existingByName = new Map(
      existingCountries.map((c) => [normalizeCountryName(c.name), c]),
    );

    for (const countryName of allCountriesFromPayload) {
      const existing = existingByName.get(countryName);
      const holidayDates = normalizedMap[countryName] || [];

      if (existing) {
        await query(
          "UPDATE country SET holiday_dates_json = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(holidayDates), existing.id],
        );
      } else {
        await query(
          "INSERT INTO country (name, holiday_dates_json) VALUES ($1, $2)",
          [countryName, JSON.stringify(holidayDates)],
        );
      }
    }

    const changedCountries = Array.isArray(body.changedCountries)
      ? body.changedCountries.map(normalizeCountryName).filter(Boolean)
      : allCountriesFromPayload;

    for (const countryName of changedCountries) {
      if (Object.prototype.hasOwnProperty.call(normalizedMap, countryName)) {
        continue;
      }

      const existing = existingByName.get(countryName);
      if (!existing) continue;

      await query(
        "UPDATE country SET holiday_dates_json = '[]', updated_at = NOW() WHERE id = $1",
        [existing.id],
      );
    }

    if (!body.syncEvents || changedCountries.length === 0) {
      return res.status(200).json({
        updatedCountries: allCountriesFromPayload.length,
        syncedParseExcel: 0,
        deletedEvents: 0,
        insertedEvents: 0,
      });
    }

    const affectedRows = await db
      .select({
        id: parseExcel.id,
        nama: parseExcel.nama,
        no_paspor: parseExcel.no_paspor,
        jenis_visa: parseExcel.jenis_visa,
        negara: country.name,
        tanggal_keberangkatan: parseExcel.tanggal_keberangkatan,
        appointment: parseExcel.appointment,
        waktu_proses_kedutaan: parseExcel.waktu_proses_kedutaan,
        waktu_proses_wepose: parseExcel.waktu_proses_wepose,
      })
      .from(parseExcel)
      .leftJoin(country, eq(parseExcel.country_id, country.id))
      .where(
        and(
          isNull(parseExcel.deletedAt),
          inArray(country.name, changedCountries),
        ),
      );

    if (affectedRows.length === 0) {
      return res.status(200).json({
        updatedCountries: allCountriesFromPayload.length,
        syncedParseExcel: 0,
        deletedEvents: 0,
        insertedEvents: 0,
      });
    }

    const timelineRows = toTimelineRows(affectedRows);
    const computedRows = calculateAll(timelineRows, {
      ...DEFAULT_CONFIG,
      holidaysByCountry: normalizedMap,
    });

    const rebuiltEvents = buildCalendarEvents(computedRows).map(toEventDbRow);

    const parseExcelIds = Array.from(
      new Set(timelineRows.map((r) => r.parse_excel_id)),
    ).filter(Boolean);

    await db
      .delete(event)
      .where(
        and(
          inArray(event.parse_excel_id, parseExcelIds),
          isNull(event.deleted_at),
        ),
      );

    if (rebuiltEvents.length > 0) {
      await db.insert(event).values(rebuiltEvents);
    }

    return res.status(200).json({
      updatedCountries: allCountriesFromPayload.length,
      syncedParseExcel: parseExcelIds.length,
      deletedEvents: parseExcelIds.length,
      insertedEvents: rebuiltEvents.length,
    });
  } catch (err) {
    console.error("Gagal menyimpan holiday/sync event:", err);
    return res
      .status(500)
      .json({ error: "Gagal menyimpan holiday negara dan sinkronisasi event" });
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") return handleGet(req, res);
  if (req.method === "POST") return handlePost(req, res);

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
