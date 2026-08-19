import { format } from "date-fns";

function fmt(d) {
  return d ? format(d, "dd MMM yyyy") : "-";
}

export default function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Nama</th>
            <th>No. Paspor</th>
            <th>Jenis Visa</th>
            <th>Negara</th>
            <th>Tanggal libur kedutaan</th>
            <th>Keberangkatan</th>
            <th>Target Visa Selesai</th>
            <th>Latest Safe Submit</th>
            <th>Appointment Kedutaan</th>
            <th>Target Analyst Selesai</th>
            <th>Target Dokumen Lengkap</th>
            <th>Follow-up Intensif</th>
            <th>Warning Date 2</th>
            <th>Warning Date 1</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={
                row.error
                  ? "row-error"
                  : row.warnings?.length
                    ? "row-warning"
                    : ""
              }
            >
              <td>{row.nama || "-"}</td>
              <td>{row.no_paspor || "-"}</td>
              <td>{row.jenis_visa || "-"}</td>
              <td>{row.negara || "-"}</td>
              <td>{fmt(row.holidaysByCountry)}</td>
              <td>{fmt(row.departureDate)}</td>
              <td>{fmt(row.targetVisaSelesai)}</td>
              <td className="cell-critical">{fmt(row.latestSafeSubmit)}</td>
              <td>{fmt(row.appointmentDate)}</td>
              <td>{fmt(row.targetAnalystSelesai)}</td>
              <td>{fmt(row.targetDokumenLengkap)}</td>
              <td>{fmt(row.tanggalFollowUpIntensif)}</td>
              <td>{fmt(row.warningDateSecond)}</td>
              <td>{fmt(row.warningDateFirst)}</td>
              <td>
                {row.error ? (
                  <span className="badge badge-error">{row.error}</span>
                ) : row.warnings?.length ? (
                  <span
                    className="badge badge-warning"
                    title={row.warnings.join("\n")}
                  >
                    ⚠ {row.warnings.length} peringatan
                  </span>
                ) : (
                  <span className="badge badge-ok">Aman</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
