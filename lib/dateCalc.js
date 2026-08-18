import { subDays, isValid, isBefore, isWeekend, differenceInCalendarDays, format } from "date-fns";

/**
 * Konfigurasi buffer default.
 * - useBusinessDays=false -> semua angka buffer/durasi dihitung HARI KALENDER (default lama).
 * - useBusinessDays=true  -> semua angka buffer/durasi dihitung HARI KERJA
 *   (Sabtu & Minggu di-skip, plus tanggal di `holidays` kalau diisi).
 * Bisa di-override lewat UI (lihat pages/index.js -> ConfigPanel).
 */
export const DEFAULT_CONFIG = {
  bufferSafe: 5, // Buffer sebelum keberangkatan agar visa "aman"
  bufferFollowUpIntensifDays: 7, // Berapa hari sebelum Latest Safe Submit mulai follow-up intensif
  bufferWarningDaysFirst: 14, // Berapa hari sebelum Latest Safe Submit warning date muncul
  bufferWarningDaysSecond: 7, // Berapa hari sebelum Latest Safe Submit warning date muncul (peringatan kedua)
  useBusinessDays: true, // toggle: hari kerja vs hari kalender
  holidays: [], // array string "YYYY-MM-DD", opsional, hanya dipakai kalau useBusinessDays=true
};

/**
 * Cek apakah sebuah tanggal termasuk hari libur (weekend, atau ada di daftar `holidays`).
 */
function isNonWorkingDay(date, holidaySet) {
  if (isWeekend(date)) return true;
  const key = format(date, "yyyy-MM-dd");
  return holidaySet.has(key);
}

/**
 * Mundur sejumlah `amount` hari dari `date`.
 * - Kalau useBusinessDays=false: mundur hari kalender biasa (subDays biasa).
 * - Kalau useBusinessDays=true: mundur sejumlah HARI KERJA (skip Sabtu/Minggu + holidays),
 *   lalu titik akhirnya juga digeser mundur lagi kalau kebetulan jatuh di hari libur,
 *   supaya semua tanggal output selalu jatuh di hari kerja.
 */
export function subtractSmart(date, amount, config = DEFAULT_CONFIG) {
  if (!config.useBusinessDays) {
    return subDays(date, amount);
  }

  const holidaySet = new Set(config.holidays || []);
  let result = date;
  let remaining = Math.round(amount);

  while (remaining > 0) {
    result = subDays(result, 1);
    if (!isNonWorkingDay(result, holidaySet)) {
      remaining -= 1;
    }
  }

  // Kalau titik awal (amount=0) atau hasil akhirnya kebetulan jatuh di hari libur,
  // geser mundur ke hari kerja terdekat sebelumnya.
  while (isNonWorkingDay(result, holidaySet)) {
    result = subDays(result, 1);
  }

  return result;
}

/**
 * Parse berbagai bentuk tanggal (Date object dari xlsx cellDates,
 * string "YYYY-MM-DD", atau serial number Excel) menjadi Date JS yang valid.
 */
export function toDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return isValid(value) ? value : null;

  if (typeof value === "number") {
    const rounded = Math.round(value);

    const excelEpochUTC = Date.UTC(1899, 11, 30);
    const utcInstant = new Date(excelEpochUTC + rounded * 86400000);

    const d = new Date(utcInstant.getUTCFullYear(), utcInstant.getUTCMonth(), utcInstant.getUTCDate());
    return isValid(d) ? d : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    let d = new Date(trimmed);
    if (isValid(d)) return d;

    const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const [, dd, mm, yyyy] = dmy;
      d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (isValid(d)) return d;
    }
  }
  return null;
}

/**
 * Ambil angka durasi (hari) dari cell excel yang mungkin berupa
 * angka, string "14 hari", atau string angka biasa.
 */
export function toDurationDays(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const match = String(value).match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Hitung seluruh pipeline tanggal untuk 1 baris data pemohon visa.
 *
 * Formula:
 *  Target Visa Selesai      = Departure Date - bufferSafe
 *  Latest Safe Submit       = Target Visa Selesai - D_visa
 *  Target Analyst Selesai   = Latest Safe Submit - D_prep
 *  Target Dokumen Lengkap   = Target Analyst Selesai - D_working_analyst
 *  Tanggal Follow-up Intensif = Latest Safe Submit - bufferFollowUpIntensifDays
 *  Warning Date 2             = Latest Safe Submit - bufferWarningDaysSecond
 *  Warning Date 1             = Latest Safe Submit - bufferWarningDaysFirst
 */
export function calculateTimeline(row, config = DEFAULT_CONFIG) {
  const departureDate = toDate(row.tanggal_keberangkatan);
  const appointmentDate = toDate(row.appointment_date);

  const dVisa = toDurationDays(row.waktu_proses_kedutaan);
  const dPrep = 1
  const dWorkingAnalyst = toDurationDays(row.waktu_proses_wepose);

  if (!departureDate) {
    return {
      ...row,
      error: "Tanggal keberangkatan tidak valid / kosong",
    };
  }

  const targetVisaSelesai = subtractSmart(departureDate, config.bufferSafe, config);
  const latestSafeSubmit = subtractSmart(targetVisaSelesai, dVisa, config);
  const targetAnalystSelesai = subtractSmart(latestSafeSubmit, dPrep, config);
  const targetDokumenLengkap = subtractSmart(targetAnalystSelesai, dWorkingAnalyst, config);
  const tanggalFollowUpIntensif = subtractSmart(latestSafeSubmit, config.bufferFollowUpIntensifDays, config);
  const warningDateSecond = subtractSmart(latestSafeSubmit, config.bufferWarningDaysSecond, config);
  const warningDateFirst = subtractSmart(latestSafeSubmit, config.bufferWarningDaysFirst, config);


  // --- Validasi silang ---
  const warnings = [];
  const today = new Date();

  if (isBefore(targetDokumenLengkap, today)) {
    warnings.push("Target dokumen lengkap sudah lewat dari hari ini (SUDAH TERLAMBAT)");
  } else if (isBefore(latestSafeSubmit, today)) {
    warnings.push("Latest Safe Submit sudah lewat, submit sekarang berisiko telat visa");
  }

  if (appointmentDate && isBefore(latestSafeSubmit, appointmentDate)) {
    warnings.push(
      `Appointment kedutaan (${format(appointmentDate, "dd MMM yyyy")}) jatuh SETELAH Latest Safe Submit — jadwal appointment perlu dimajukan`
    );
  }

  const totalLeadTimeDays = differenceInCalendarDays(departureDate, targetDokumenLengkap);

  return {
    ...row,
    departureDate,
    appointmentDate,
    dVisa,
    dPrep,
    targetVisaSelesai,
    latestSafeSubmit,
    targetAnalystSelesai,
    targetDokumenLengkap,
    tanggalFollowUpIntensif,
    warningDateSecond,
    warningDateFirst,
    totalLeadTimeDays,
    warnings,
    error: null,
  };
}

export function calculateAll(rows, config = DEFAULT_CONFIG) {
  return rows.map((row) => calculateTimeline(row, config));
}
