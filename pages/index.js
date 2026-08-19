import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { parseExcelFile, generateTemplateWorkbook, downloadWorkbook } from "../lib/excelParser";
import { calculateAll, DEFAULT_CONFIG } from "../lib/dateCalc";
import { buildCalendarEvents } from "../lib/calendarEvents";
import { downloadIcsFile } from "../lib/icsExport";
import ResultTable from "../components/ResultTable";
import ConfigPanel from "../components/ConfigPanel";

// FullCalendar pakai DOM API, jadi harus di-load client-only
const VisaCalendar = dynamic(() => import("../components/VisaCalendar"), { ssr: false });

export default function Home() {
  const [rawRows, setRawRows] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [fileName, setFileName] = useState("");
  const [parseInfo, setParseInfo] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const fileInputRef = useRef(null);

  const calculatedRows = useMemo(() => calculateAll(rawRows, config), [rawRows, config]);
  const calendarEvents = useMemo(() => buildCalendarEvents(calculatedRows), [calculatedRows]);

  const availableCountries = useMemo(
    () =>
      Array.from(new Set(rawRows.map((r) => String(r.negara || "").trim()).filter(Boolean))).sort(),
    [rawRows]
  );

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const arrayBuffer = await file.arrayBuffer();
    const { rows, unrecognizedHeaders } = parseExcelFile(arrayBuffer);
    setRawRows(rows);
    setParseInfo({ count: rows.length, unrecognizedHeaders });
  }

  function handleDownloadTemplate() {
    const wb = generateTemplateWorkbook();
    downloadWorkbook(wb, "template-data-visa.xlsx");
  }

  function handleExportIcs() {
    if (calculatedRows.length === 0) return;
    downloadIcsFile(calculatedRows, "visa-reminders.ics");
  }

  function resetAll() {
    setRawRows([]);
    setFileName("");
    setParseInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="container">
      <header>
        <h1>📅 Sistem Reminder Timeline Visa</h1>
        <p className="subtitle">
          Upload data Excel → sistem otomatis hitung timeline (Target Visa Selesai, Latest Safe Submit, Target
          Analyst Selesai, Target Dokumen Lengkap, Follow-up Intensif, Warning Date) → tampil di kalender & bisa
          diexport jadi reminder.
        </p>
      </header>

      <section className="upload-section">
        <div className="upload-box">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="btn btn-primary">
            📤 Upload File Excel
          </label>
          {fileName && <span className="filename">{fileName}</span>}
          <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
            ⬇ Download Template Excel
          </button>
          {rawRows.length > 0 && (
            <button className="btn btn-ghost" onClick={resetAll}>
              ✕ Reset
            </button>
          )}
        </div>

        {parseInfo && (
          <div className="parse-info">
            <p>
              ✅ Berhasil membaca <b>{parseInfo.count}</b> baris data.
            </p>
            {parseInfo.unrecognizedHeaders?.length > 0 && (
              <p className="warn-text">
                ⚠ Kolom berikut tidak dikenali dan diabaikan: {parseInfo.unrecognizedHeaders.join(", ")}
              </p>
            )}
          </div>
        )}
      </section>

      {rawRows.length > 0 && (
        <>
          <ConfigPanel config={config} setConfig={setConfig} availableCountries={availableCountries} />

          <section className="actions-row">
            <button className="btn btn-primary" onClick={handleExportIcs}>
              📆 Export Reminder (.ics) — Import ke Google/Outlook Calendar
            </button>
          </section>

          <section>
            <h2>📋 Tabel Hasil Kalkulasi</h2>
            <ResultTable rows={calculatedRows} />
          </section>

          <section>
            <h2>🗓 Tampilan Kalender</h2>
            <VisaCalendar events={calendarEvents} onEventClick={(ev) => setSelectedEvent(ev)} />
          </section>

          {selectedEvent && (
            <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{selectedEvent.title}</h3>
                <p>
                  <b>Tahap:</b> {selectedEvent.extendedProps.stage}
                </p>
                <p>
                  <b>No. Paspor:</b> {selectedEvent.extendedProps.no_paspor || "-"}
                </p>
                <p>
                  <b>Jenis Visa:</b> {selectedEvent.extendedProps.jenis_visa || "-"}
                </p>
                <p>
                  <b>Tanggal:</b> {selectedEvent.startStr}
                </p>
                {selectedEvent.extendedProps.warnings?.length > 0 && (
                  <div className="modal-warnings">
                    <b>⚠ Peringatan:</b>
                    <ul>
                      {selectedEvent.extendedProps.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)}>
                  Tutup
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {rawRows.length === 0 && (
        <div className="empty-state">
          <p>Belum ada data. Upload file Excel atau download template dulu untuk melihat format yang benar.</p>
          <p className="empty-columns">
            Kolom yang dibutuhkan: <code>nama</code>, <code>no_paspor</code>,{" "}
            <code>tanggal_keberangkatan</code>, <code>jenis_visa</code>, <code>appointment_date</code>,{" "}
            <code>waktu_proses_kedutaan</code>, <code>waktu_proses_wepose</code>
          </p>
        </div>
      )}
    </div>
  );
}
