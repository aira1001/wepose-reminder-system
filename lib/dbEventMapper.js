import { parseISO } from "date-fns";

// Peta label stage (persis seperti STAGE_DEFS di lib/calendarEvents.js)
// ke key timestamp yang dirender ResultTable / dipakai buildCalendarEvents.
const STAGE_TO_KEY = {
  "Warning Date 1": "warningDateFirst",
  "Warning Date 2": "warningDateSecond",
  "Follow-up Intensif": "tanggalFollowUpIntensif",
  "Target Dokumen Lengkap": "targetDokumenLengkap",
  "Target Analyst Selesai": "targetAnalystSelesai",
  "Appointment Kedutaan": "appointmentDate",
  "Latest Safe Submit": "latestSafeSubmit",
  "Target Visa Selesai": "targetVisaSelesai",
  "Tanggal Keberangkatan": "departureDate",
};

// Stage yang TIDAK menghasilkan satu titik tanggal (event berulang harian)
const REPEATED_STAGE_PREFIX = "Follow-up Harian";

/** Ubah 'yyyy-MM-dd' (atau tanggal db) jadi Date, atau null. */
function toDate(value) {
  if (!value) return null;
  const d = parseISO(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Map array baris tabel `event` (dari GET /api/events) menjadi
 * calculated rows siap render ResultTable + kalender.
 * Setiap baris event milestone dengan stage yang dikenal menjadi 1 row.
 * Event follow-up harian (berulang) dilewati, tidak dipakai untuk tabel hasil.
 */
export function mapEventRowsToCalculated(rows) {
  const byPerson = new Map();

  for (const ev of rows) {
    if (ev.deletedAt) continue;
    const stage = ev.stage;
    const key = STAGE_TO_KEY[stage];
    if (!key || String(stage).startsWith(REPEATED_STAGE_PREFIX)) continue;

    let person = byPerson.get(ev.parse_excel_id ?? ev.nama + ev.no_paspor);
    if (!person) {
      person = {
        id: ev.parse_excel_id ?? null,
        nama: ev.nama,
        no_paspor: ev.no_paspor,
        jenis_visa: ev.jenis_visa,
        negara: ev.negara, // event tidak simpan negara; diisi dari parse_excel kalau ada
        warnings: [],
        error: null,
      };
      byPerson.set(ev.parse_excel_id ?? ev.nama + ev.no_paspor, person);
    }

    const date = toDate(ev.start_date);
    if (date) person[key] = date;
  }

  return Array.from(byPerson.values());
}

/**
 * Map baris tabel `event` (dari GET /api/events) kembali ke bentuk
 * event FullCalendar (id, title, start, allDay, backgroundColor, ...),
 * siap dirender <VisaCalendar>.
 */
export function mapDbEventsToCalendarEvents(events) {
  return (events || [])
    .filter((ev) => !ev.deletedAt)
    .map((ev) => ({
      id: ev.event_id || String(ev.id),
      title: ev.title,
      start: ev.start_date,
      allDay: ev.all_day,
      backgroundColor: ev.background_color,
      borderColor: ev.border_color,
      extendedProps: {
        nama: ev.nama,
        no_paspor: ev.no_paspor,
        jenis_visa: ev.jenis_visa,
        stage: ev.stage,
        warnings: ev.warnings,
        parse_excel_id: ev.parse_excel_id,
      },
    }));
}