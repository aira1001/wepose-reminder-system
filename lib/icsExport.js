import { createEvents } from "ics";

const EVENT_DEFS = [
  {
    key: "targetDokumenLengkap",
    label: "Target Dokumen Lengkap (Safe Deadline)",
    reminderDaysBefore: [3, 1],
  },
  {
    key: "tanggalFollowUpIntensif",
    label: "Mulai Follow-up Intensif",
    reminderDaysBefore: [0],
  },
  {
    key: "targetAnalystSelesai",
    label: "Target Analyst Selesai (Tight Deadline)",
    reminderDaysBefore: [1],
  },
  {
    key: "warningDate",
    label: "⚠ WARNING — Mendekati Latest Safe Submit",
    reminderDaysBefore: [0],
  },
  {
    key: "latestSafeSubmit",
    label: "🚨 LATEST SAFE SUBMIT (Critical Deadline)",
    reminderDaysBefore: [1, 0],
  },
  {
    key: "targetVisaSelesai",
    label: "Target Visa Selesai",
    reminderDaysBefore: [1],
  },
];

function toIcsDateArray(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

/**
 * Ubah hasil kalkulasi (array dari calculateAll) menjadi array event
 * untuk library `ics`.
 */
export function buildIcsEvents(calculatedRows) {
  const events = [];

  calculatedRows.forEach((row) => {
    if (row.error) return;

    EVENT_DEFS.forEach((def) => {
      const date = row[def.key];
      if (!date) return;

      events.push({
        title: `[${row.jenis_visa || "Visa"}] ${row.nama} — ${def.label}`,
        description: [
          `Nama: ${row.nama}`,
          `No. Paspor: ${row.no_paspor || "-"}`,
          `Jenis Visa: ${row.jenis_visa || "-"}`,
          `Tanggal Keberangkatan: ${row.departureDate ? row.departureDate.toDateString() : "-"}`,
          row.warnings && row.warnings.length ? `\nPERHATIAN:\n- ${row.warnings.join("\n- ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        start: toIcsDateArray(date),
        duration: { hours: 1 },
        alarms: (def.reminderDaysBefore || []).map((d) => ({
          action: "display",
          trigger: { days: d, before: true },
        })),
      });
    });
  });

  return events;
}

/**
 * Generate file .ics sebagai string, siap di-download di browser.
 */
export function generateIcsString(calculatedRows) {
  const events = buildIcsEvents(calculatedRows);
  const { error, value } = createEvents(events);
  if (error) {
    console.error(error);
    throw error;
  }
  return value;
}

export function downloadIcsFile(calculatedRows, filename = "visa-reminders.ics") {
  const icsString = generateIcsString(calculatedRows);
  const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
