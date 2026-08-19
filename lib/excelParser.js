import * as XLSX from "xlsx";

/**
 * Mapping header Excel (fleksibel, tidak case-sensitive, boleh pakai spasi)
 * ke nama field internal yang dipakai dateCalc.js
 */
const HEADER_MAP = {
  nama: "nama",
  name: "nama",
  pic: "pic",
  no_paspor: "no_paspor",
  "no paspor": "no_paspor",
  nomor_paspor: "no_paspor",
  passport: "no_paspor",
  tanggal_keberangkatan: "tanggal_keberangkatan",
  "tanggal keberangkatan": "tanggal_keberangkatan",
  departure_date: "tanggal_keberangkatan",
  jenis_visa: "jenis_visa",
  "jenis visa": "jenis_visa",
  negara: "negara",
  country: "negara",
  negara_tujuan: "negara",
  "negara tujuan": "negara",
  destination_country: "negara",
  visa_type: "jenis_visa",
  appointment_date: "appointment_date",
  "appointment date": "appointment_date",
  waktu_poses_kedutaan: "waktu_proses_kedutaan",
  waktu_proses_kedutaan: "waktu_proses_kedutaan",
  "waktu proses kedutaan": "waktu_proses_kedutaan",
  "waktu poses kedutaan": "waktu_proses_kedutaan",
  waktu_proses_wepose: "waktu_proses_wepose",
  "waktu proses wepose": "waktu_proses_wepose",
  waktu_wepose: "waktu_proses_wepose",
};

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase();
}

/**
 * Parse file Excel (ArrayBuffer) menjadi array of objects
 * dengan key ternormalisasi sesuai HEADER_MAP.
 */
export function parseExcelFile(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false,
    raw: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return { rows: [], unrecognizedHeaders: [] };
  }

  const originalHeaders = Object.keys(rawRows[0]);
  const unrecognizedHeaders = [];

  const rows = rawRows.map((rawRow) => {
    const normalized = {};
    for (const key of Object.keys(rawRow)) {
      const mapped = HEADER_MAP[normalizeHeader(key)];
      if (mapped) {
        normalized[mapped] = rawRow[key];
      } else if (!unrecognizedHeaders.includes(key)) {
        unrecognizedHeaders.push(key);
      }
    }
    return normalized;
  });

  return { rows, unrecognizedHeaders, originalHeaders };
}

/**
 * Bikin template Excel contoh (dipakai tombol "Download Template")
 */
export function generateTemplateWorkbook() {
  const sampleData = [
    {
      nama: "Budi Santoso",
      pic: "John Doe",
      no_paspor: "A1234567",
      tanggal_keberangkatan: "2026-12-20",
      jenis_visa: "German Business",
      negara: "Germany",
      appointment_date: "2026-11-15",
      waktu_proses_kedutaan: 15,
      waktu_proses_wepose: 3,
    },
    {
      nama: "Siti Aminah",
      pic: "Jane Smith",
      no_paspor: "B7654321",
      tanggal_keberangkatan: "2026-11-05",
      jenis_visa: "Korea Single Tourist",
      negara: "Korea",
      appointment_date: "",
      waktu_proses_kedutaan: 10,
      waktu_proses_wepose: 3,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Visa");
  return wb;
}

export function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}
