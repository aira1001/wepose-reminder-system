import { useState } from "react";

export default function ConfigPanel({
  config,
  setConfig,
  availableCountries = [],
}) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [dateInput, setDateInput] = useState("");

  const handleChange = (key) => (e) => {
    const val = Number(e.target.value);
    setConfig((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  const handleToggleBusinessDays = (e) => {
    setConfig((prev) => ({ ...prev, useBusinessDays: e.target.checked }));
  };

  const holidaysByCountry = config.holidaysByCountry || {};
  const configuredCountries = Object.keys(holidaysByCountry);
  const dropdownOptions = Array.from(
    new Set([...availableCountries, ...configuredCountries]),
  ).sort();

  function normalizeDates(raw) {
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      })
      .filter(Boolean);
  }

  function handleAppendDates() {
    const country = selectedCountry.trim();
    if (!country) return;

    const newDates = normalizeDates(dateInput);
    if (newDates.length === 0) return;

    setConfig((prev) => {
      const prevMap = prev.holidaysByCountry || {};
      const existingKey = Object.keys(prevMap).find(
        (k) => k.trim().toLowerCase() === country.toLowerCase(),
      );
      const key = existingKey || country;
      const merged = Array.from(
        new Set([...(prevMap[key] || []), ...newDates]),
      ).sort();

      return {
        ...prev,
        holidaysByCountry: { ...prevMap, [key]: merged },
      };
    });

    setDateInput("");
  }

  function handleRemoveDate(country, dateStr) {
    setConfig((prev) => {
      const prevMap = prev.holidaysByCountry || {};
      const updated = (prevMap[country] || []).filter((d) => d !== dateStr);
      const next = { ...prevMap, [country]: updated };
      if (updated.length === 0) delete next[country];
      return { ...prev, holidaysByCountry: next };
    });
  }

  function handleRemoveCountry(country) {
    setConfig((prev) => {
      const next = { ...(prev.holidaysByCountry || {}) };
      delete next[country];
      return { ...prev, holidaysByCountry: next };
    });
  }

  return (
    <div className="config-panel">
      <h3>⚙️ Parameter Buffer</h3>

      <div className="mode-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={config.useBusinessDays}
            onChange={handleToggleBusinessDays}
          />
          Hitung berdasarkan <b>hari kerja</b> (Sabtu &amp; Minggu di-skip)
        </label>
        <span className="mode-hint">
          {config.useBusinessDays
            ? "Semua buffer & durasi di bawah dihitung dalam HARI KERJA."
            : "Semua buffer & durasi di bawah dihitung dalam hari kalender biasa."}
        </span>
      </div>

      <div className="config-grid">
        <label>
          Buffer Safe (sebelum keberangkatan)
          <input
            type="number"
            min="0"
            value={config.bufferSafe}
            onChange={handleChange("bufferSafe")}
          />
        </label>
      </div>

      {config.useBusinessDays && (
        <div className="holiday-manager">
          <h4>🌍 Hari Libur Nasional per Negara</h4>
          <p className="config-note">
            Dicocokkan ke kolom <code>negara</code> di file excel
            (case-insensitive). Baris dengan negara yang belum terdaftar di sini
            hanya akan skip Sabtu/Minggu saja.
          </p>

          <div className="holiday-add-row">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <option value="">-- Pilih negara --</option>
              {dropdownOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <textarea
              rows={1}
              placeholder="Tanggal libur (YYYY-MM-DD), mis. 2026-07-08, 2026-07-09"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAppendDates}
            >
              + Tambah
            </button>
          </div>

          {configuredCountries.length > 0 && (
            <div className="holiday-list">
              {configuredCountries.map((country) => (
                <div key={country} className="holiday-country-block">
                  <div className="holiday-country-header">
                    <b>{country}</b>
                    <button
                      type="button"
                      className="btn-remove-country"
                      onClick={() => handleRemoveCountry(country)}
                    >
                      Hapus semua
                    </button>
                  </div>
                  <div className="holiday-chip-row">
                    {holidaysByCountry[country].map((d) => (
                      <span key={d} className="holiday-chip">
                        {d}
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(country, d)}
                          aria-label="Hapus tanggal"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
