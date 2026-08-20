import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  parseExcelFile,
  generateTemplateWorkbook,
  downloadWorkbook,
} from "../lib/excelParser";
import { calculateAll, DEFAULT_CONFIG } from "../lib/dateCalc";
import {
  buildCalendarEvents,
  buildHolidayCalendarEvents,
} from "../lib/calendarEvents";
import {
  mapEventRowsToCalculated,
  mapDbEventsToCalendarEvents,
} from "../lib/dbEventMapper";
import { downloadIcsFile } from "../lib/icsExport";
import ResultTable from "../components/ResultTable";
import ConfigPanel from "../components/ConfigPanel";

// FullCalendar pakai DOM API, jadi harus di-load client-only
const VisaCalendar = dynamic(() => import("../components/VisaCalendar"), {
  ssr: false,
});

function normalizeHolidaysByCountry(input) {
  const out = {};
  Object.entries(input || {}).forEach(([country, dates]) => {
    const key = String(country || "").trim();
    if (!key) return;
    const normalizedDates = Array.isArray(dates)
      ? Array.from(
          new Set(
            dates
              .map((d) => String(d || "").trim())
              .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
          ),
        ).sort()
      : [];
    out[key] = normalizedDates;
  });
  return out;
}

function getChangedCountries(prevMap, nextMap) {
  const names = new Set([
    ...Object.keys(prevMap || {}),
    ...Object.keys(nextMap || {}),
  ]);
  return Array.from(names).filter((name) => {
    const prev = JSON.stringify((prevMap && prevMap[name]) || []);
    const next = JSON.stringify((nextMap && nextMap[name]) || []);
    return prev !== next;
  });
}

export default function Home() {
  const [rawRows, setRawRows] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [fileName, setFileName] = useState("");
  const [parseInfo, setParseInfo] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dbEvents, setDbEvents] = useState([]);
  const [loadingFromDb, setLoadingFromDb] = useState(false);
  const [holidaySyncState, setHolidaySyncState] = useState({
    status: "idle",
    message: "",
  });
  const fileInputRef = useRef(null);
  const prevHolidayMapRef = useRef(null);

  const loadFromDb = useCallback(async () => {
    try {
      setLoadingFromDb(true);
      const [eventRes, holidayRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/country-holidays"),
      ]);

      const eventData = await eventRes.json();
      if (eventRes.ok) {
        setDbEvents(eventData.events || []);
      } else {
        console.error("Gagal load event dari DB:", eventData.error);
      }

      const holidayData = await holidayRes.json();
      if (holidayRes.ok) {
        const holidayMap = normalizeHolidaysByCountry(
          holidayData.holidaysByCountry || {},
        );
        prevHolidayMapRef.current = holidayMap;
        setConfig((prev) => ({ ...prev, holidaysByCountry: holidayMap }));
      } else {
        console.error("Gagal load holiday negara:", holidayData.error);
      }
    } catch (err) {
      console.error("Gagal fetch /api/events:", err);
    } finally {
      setLoadingFromDb(false);
    }
  }, []);

  useEffect(() => {
    loadFromDb();
  }, [loadFromDb]);

  useEffect(() => {
    if (rawRows.length > 0) return;

    const currentMap = normalizeHolidaysByCountry(
      config.holidaysByCountry || {},
    );
    const prevMap = prevHolidayMapRef.current;

    if (!prevMap) {
      prevHolidayMapRef.current = currentMap;
      return;
    }

    const changedCountries = getChangedCountries(prevMap, currentMap);
    if (changedCountries.length === 0) return;

    prevHolidayMapRef.current = currentMap;
    let cancelled = false;

    async function persistHolidayAndSyncEvents() {
      setHolidaySyncState({
        status: "syncing",
        message: "Menyimpan hari libur dan sinkronisasi event...",
      });

      try {
        const res = await fetch("/api/country-holidays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holidaysByCountry: currentMap,
            changedCountries,
            syncEvents: true,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Gagal sinkronisasi event");
        }

        if (!cancelled) {
          setHolidaySyncState({
            status: "success",
            message: `Sinkronisasi selesai (${data.syncedParseExcel || 0} data pemohon diperbarui).`,
          });
          await loadFromDb();
        }
      } catch (err) {
        if (!cancelled) {
          setHolidaySyncState({
            status: "error",
            message: err.message || "Gagal sinkronisasi holiday/event",
          });
        }
      }
    }

    persistHolidayAndSyncEvents();

    return () => {
      cancelled = true;
    };
  }, [rawRows.length, config.holidaysByCountry, loadFromDb]);

  const calculatedRows = useMemo(() => {
    if (rawRows.length > 0) {
      return calculateAll(rawRows, config);
    }
    return mapEventRowsToCalculated(dbEvents, config);
  }, [rawRows, dbEvents, config]);

  const holidayCalendarEvents = useMemo(
    () => buildHolidayCalendarEvents(config),
    [config],
  );

  const calendarEvents = useMemo(() => {
    const baseEvents =
      rawRows.length > 0
        ? buildCalendarEvents(calculatedRows)
        : mapDbEventsToCalendarEvents(dbEvents);

    return [...baseEvents, ...holidayCalendarEvents];
  }, [rawRows, calculatedRows, dbEvents, holidayCalendarEvents]);

  const availableCountries = useMemo(
    () =>
      Array.from(
        new Set(
          rawRows
            .map((r) => String(r.negara || "").trim())
            .concat(dbEvents.map((e) => String(e.negara || "").trim()))
            .filter(Boolean),
        ),
      ).sort(),
    [rawRows, dbEvents],
  );

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const arrayBuffer = await file.arrayBuffer();
    const { rows, unrecognizedHeaders } = parseExcelFile(arrayBuffer);
    setRawRows(rows);
    setParseInfo({ count: rows.length, unrecognizedHeaders, saving: true });

    try {
      const res = await fetch("/api/parse-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Gagal menyimpan (status ${res.status})`);
      }

      const rowsWithIds = rows.map((row, i) => ({
        ...row,
        parse_excel_id: data.ids?.[i] ?? null,
      }));

      // Hitung event kalender dari rows ber-id (untuk disimpan juga ke DB)
      const computedRows = calculateAll(rowsWithIds, config);
      const events = buildCalendarEvents(computedRows);

      // Simpan event kalender ke PostgreSQL (tabel event)
      const evRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      const evData = await evRes.json();
      if (!evRes.ok) {
        throw new Error(
          evData.error || `Gagal simpan event (status ${evRes.status})`,
        );
      }
      setParseInfo({
        count: rows.length,
        unrecognizedHeaders,
        saved: data.inserted,
        eventsSaved: evData.inserted,
      });
    } catch (err) {
      console.error(err);
      setParseInfo({
        count: rows.length,
        unrecognizedHeaders,
        saveError: err.message,
      });
    }
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
    setDbEvents([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="container">
      <header>
        <h1>📅 Sistem Reminder Timeline Visa</h1>
        <p className="subtitle">
          Upload data Excel → sistem otomatis hitung timeline (Target Visa
          Selesai, Latest Safe Submit, Target Analyst Selesai, Target Dokumen
          Lengkap, Follow-up Intensif, Warning Date) → tampil di kalender & bisa
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
          <button
            className="btn btn-secondary"
            onClick={handleDownloadTemplate}
          >
            ⬇ Download Template Excel
          </button>
          {(rawRows.length > 0 || dbEvents.length > 0) && (
            <button className="btn btn-ghost" onClick={resetAll}>
              ✕ Reset
            </button>
          )}
        </div>

        {parseInfo && (
          <div className="parse-info">
            <p>
              ✅ Berhasil membaca <b>{parseInfo.count}</b> baris data.
              {parseInfo.saving && " — sedang menyimpan ke database…"}
              {parseInfo.saved !== undefined &&
                ` → ${parseInfo.saved} baris tersimpan ke PostgreSQL.`}
              {parseInfo.eventsSaved !== undefined &&
                ` ${parseInfo.eventsSaved} event kalender tersimpan.`}
            </p>
            {parseInfo.saveError && (
              <p className="warn-text">
                ⚠ Gagal menyimpan ke database: {parseInfo.saveError} (data tetap
                tampil di halaman ini, tapi belum masuk PostgreSQL).
              </p>
            )}
            {parseInfo.unrecognizedHeaders?.length > 0 && (
              <p className="warn-text">
                ⚠ Kolom berikut tidak dikenali dan diabaikan:{" "}
                {parseInfo.unrecognizedHeaders.join(", ")}
              </p>
            )}
          </div>
        )}
      </section>

      {(rawRows.length > 0 || dbEvents.length > 0) && (
        <>
          {loadingFromDb && (
            <p className="parse-info">⏳ Memuat data dari database…</p>
          )}
          <ConfigPanel
            config={config}
            setConfig={setConfig}
            availableCountries={availableCountries}
          />

          {rawRows.length === 0 && holidaySyncState.status !== "idle" && (
            <p className="parse-info">
              {holidaySyncState.status === "syncing" && "⏳ "}
              {holidaySyncState.status === "success" && "✅ "}
              {holidaySyncState.status === "error" && "⚠ "}
              {holidaySyncState.message}
            </p>
          )}

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
            <VisaCalendar
              events={calendarEvents}
              onEventClick={(ev) => setSelectedEvent(ev)}
            />
          </section>

          {selectedEvent && (
            <div
              className="modal-backdrop"
              onClick={() => setSelectedEvent(null)}
            >
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{selectedEvent.title}</h3>
                <p>
                  <b>Tahap:</b> {selectedEvent.extendedProps.stage}
                </p>
                <p>
                  <b>No. Paspor:</b>{" "}
                  {selectedEvent.extendedProps.no_paspor || "-"}
                </p>
                <p>
                  <b>Jenis Visa:</b>{" "}
                  {selectedEvent.extendedProps.jenis_visa || "-"}
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedEvent(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {rawRows.length === 0 && dbEvents.length === 0 && (
        <div className="empty-state">
          <p>
            Belum ada data. Upload file Excel atau download template dulu untuk
            melihat format yang benar.
          </p>
          <p className="empty-columns">
            Kolom yang dibutuhkan: <code>nama</code>, <code>no_paspor</code>,{" "}
            <code>tanggal_keberangkatan</code>, <code>jenis_visa</code>,{" "}
            <code>appointment_date</code>, <code>waktu_proses_kedutaan</code>,{" "}
            <code>waktu_proses_wepose</code>
          </p>
        </div>
      )}
    </div>
  );
}
