import { eachDayOfInterval, format, isBefore, isWeekend } from "date-fns";

// Definisi warna & urutan tahapan (dipakai di kalender + legend)
export const STAGE_DEFS = [
  { key: "warningDateFirst", label: "Warning Date 1", color: "#e77474" }, // merah muda-ish
  { key: "warningDateSecond", label: "Warning Date 2", color: "#ef4444" }, // merah muda-ish
  { key: "tanggalFollowUpIntensif", label: "Follow-up Intensif", color: "#eab308" }, // kuning
  { key: "targetDokumenLengkap", label: "Target Dokumen Lengkap", color: "#22c55e" }, // hijau
  { key: "targetAnalystSelesai", label: "Target Analyst Selesai", color: "#f97316" }, // oranye
  { key: "appointmentDate", label: "Appointment Kedutaan", color: "#1556fa" }, // biru
  { key: "latestSafeSubmit", label: "Latest Safe Submit", color: "#b91c1c" }, // merah tua
  { key: "targetVisaSelesai", label: "Target Visa Selesai", color: "#3b82f6" }, // biru
  { key: "departureDate", label: "Tanggal Keberangkatan", color: "#7c3aed" }, // ungu
];
export const FOLLOW_UP_COLOR = "#eab308"; // kuning, sama seperti sebelumnya
export const FOLLOW_UP_LABEL = "Follow-up Harian";

function buildFollowUpEvents(row, idx, { skipWeekends = true } = {}) {
  const start = row.tanggalFollowUpIntensif;
  const end = row.targetAnalystSelesai;

  if (!start || !end) return [];
  // Kalau urutan kebalik (start setelah end), tetap tampilkan minimal 1 hari di `start`
  if (isBefore(end, start)) {
    return [
      {
        id: `${idx}-followup-0`,
        title: `${row.nama}: ${FOLLOW_UP_LABEL}`,
        start: format(start, "yyyy-MM-dd"),
        allDay: true,
        backgroundColor: FOLLOW_UP_COLOR,
        borderColor: FOLLOW_UP_COLOR,
        extendedProps: {
          nama: row.nama,
          no_paspor: row.no_paspor,
          jenis_visa: row.jenis_visa,
          stage: FOLLOW_UP_LABEL,
          warnings: row.warnings,
        },
      },
    ];
  }
  const allDays = eachDayOfInterval({ start, end });
  const activeDays = skipWeekends ? allDays.filter((d) => !isWeekend(d)) : allDays;

  return activeDays.map((date, i) => ({
    id: `${idx}-followup-${i}`,
    title: `${row.nama}: ${FOLLOW_UP_LABEL}`,
    start: format(date, "yyyy-MM-dd"),
    allDay: true,
    backgroundColor: FOLLOW_UP_COLOR,
    borderColor: FOLLOW_UP_COLOR,
    extendedProps: {
      nama: row.nama,
      no_paspor: row.no_paspor,
      jenis_visa: row.jenis_visa,
      stage: `${FOLLOW_UP_LABEL} (Hari ${i + 1}/${activeDays.length})`,
      warnings: row.warnings,
    },
  }));
}

export function buildCalendarEvents(calculatedRows) {
  const events = [];

  calculatedRows.forEach((row, idx) => {
    if (row.error) return;

    STAGE_DEFS.filter((stage) => stage.key !== "tanggalFollowUpIntensif").forEach((stage) => {
      const date = row[stage.key];
      if (!date) return;

      events.push({
        id: `${idx}-${stage.key}`,
        title: `${row.nama}: ${stage.label}`,
        start: format(date, "yyyy-MM-dd"),
        allDay: true,
        backgroundColor: stage.color,
        borderColor: stage.color,
        extendedProps: {
          nama: row.nama,
          no_paspor: row.no_paspor,
          jenis_visa: row.jenis_visa,
          stage: stage.label,
          warnings: row.warnings,
        },
      });
    });
    events.push(...buildFollowUpEvents(row, idx, { skipWeekends: true }));
  });

  return events;
}
