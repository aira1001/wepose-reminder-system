export default function ConfigPanel({ config, setConfig }) {
  const handleChange = (key) => (e) => {
    const val = Number(e.target.value);
    setConfig((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
  };

  const handleToggleBusinessDays = (e) => {
    setConfig((prev) => ({ ...prev, useBusinessDays: e.target.checked }));
  };

  const handleHolidaysChange = (e) => {
    // input dipisah koma/baris baru, format bebas asal bisa di-parse ke YYYY-MM-DD
    const raw = e.target.value;
    const holidays = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      })
      .filter(Boolean);
    setConfig((prev) => ({ ...prev, holidays, holidaysRaw: raw }));
  };

  return (
    <div className="config-panel">
      <h3>⚙️ Parameter Buffer</h3>

      <div className="mode-toggle">
        <label className="toggle-label">
          <input type="checkbox" checked={config.useBusinessDays} onChange={handleToggleBusinessDays} />
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
          <input type="number" min="0" value={config.bufferSafe} onChange={handleChange("bufferSafe")} />
        </label>
      </div>

      {config.useBusinessDays && (
        <div className="holiday-input">
          <label>
            Daftar hari libur nasional (opsional, ikut di-skip seperti weekend)
            <textarea
              rows={2}
              placeholder="contoh: 2026-08-17, 2026-12-25, 2026-01-01"
              value={config.holidaysRaw || ""}
              onChange={handleHolidaysChange}
            />
          </label>
          <span className="config-note">
            Pisahkan tiap tanggal dengan koma atau baris baru, format bebas asal jelas (mis. 2026-12-25).
          </span>
        </div>
      )}

      <p className="config-note">
        D_visa (waktu proses kedutaan) dan D_prep (waktu proses wepose) diambil langsung dari kolom Excel per baris
        data — nilai ini juga ikut dihitung sebagai hari kerja kalau toggle di atas aktif.
      </p>
    </div>
  );
}
