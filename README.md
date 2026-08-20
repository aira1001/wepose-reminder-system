# Sistem Reminder Timeline Visa

Aplikasi Next.js untuk mengubah data pengajuan visa (Excel) menjadi timeline reminder yang
tervisualisasi di kalender (pakai [FullCalendar](https://fullcalendar.io/)) dan bisa diexport
ke file `.ics` untuk diimport ke Google Calendar / Outlook / Apple Calendar.

## Cara Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Deploy di Vercel (Dengan Auto Migration)

Project ini menyediakan script build khusus untuk Vercel yang akan:

1. Menjalankan migration database via Drizzle.
2. Melanjutkan proses `next build`.

Script: `scripts/vercel-build.sh`

Set **Build Command** di Vercel menjadi:

```bash
npm run build:vercel
```

Pastikan environment variable ini tersedia di Vercel:

- `DATABASE_URL` (wajib)
- `SKIP_DB_MIGRATION=1` (opsional, kalau ingin skip migration di environment tertentu)

## Alur Pakai

1. Klik **Download Template Excel** untuk lihat format kolom yang benar (atau siapkan sendiri
   dengan kolom di bawah).
2. Isi data, lalu **Upload File Excel**.
3. Atur parameter buffer di panel **⚙️ Parameter Buffer** kalau perlu (defaultnya sudah masuk akal).
4. Lihat hasil di **Tabel Hasil Kalkulasi** dan **Tampilan Kalender**.
5. Klik **Export Reminder (.ics)** untuk download file kalender, lalu import ke Google
   Calendar / Outlook (biasanya lewat menu "Import" di pengaturan kalender).

## Kolom Input Excel

| Kolom                   | Keterangan                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| `nama`                  | Nama pemohon                                                       |
| `no_paspor`             | Nomor paspor                                                       |
| `tanggal_keberangkatan` | Tanggal keberangkatan (WAJIB)                                      |
| `jenis_visa`            | Jenis visa yang diajukan                                           |
| `appointment_date`      | Tanggal appointment di kedutaan (opsional, dipakai untuk validasi) |
| `waktu_proses_kedutaan` | D_visa, estimasi lama proses kedutaan (hari)                       |
| `waktu_proses_wepose`   | D_prep, estimasi lama proses preparation/analyst (hari)            |

Nama kolom bebas variasi kecil (huruf besar/kecil, spasi vs underscore) — lihat
`lib/excelParser.js` bagian `HEADER_MAP` kalau mau menambah alias.

## Formula Perhitungan

```
Target Visa Selesai        = Tanggal Keberangkatan - Buffer Safe
Latest Safe Submit         = Target Visa Selesai - D_visa
Target Analyst Selesai     = Latest Safe Submit - D_prep
Target Dokumen Lengkap     = Target Analyst Selesai - Buffer Follow-up
Tanggal Follow-up Intensif = Latest Safe Submit - Buffer Follow-up Intensif
Warning Date                = Latest Safe Submit - Buffer Warning
```

Semua buffer bisa diubah lewat UI (disimpan di state React, default ada di
`lib/dateCalc.js` -> `DEFAULT_CONFIG`).

> **Catatan:** Formula "Tanggal Follow-up Intensif" dan "Warning Date" tidak dispesifikkan
> secara eksplisit di requirement awal, jadi diasumsikan sebagai _H- sekian hari_ dari
> **Latest Safe Submit** (bisa diubah bebas lewat panel konfigurasi sesuai kebutuhan real).

## Validasi Otomatis

Sistem otomatis memberi warning (badge kuning di tabel + di detail event kalender) kalau:

- Tanggal hari ini sudah melewati `Target Dokumen Lengkap` atau `Latest Safe Submit`.
- `appointment_date` jatuh setelah `Latest Safe Submit` (appointment kedutaan kepepet).

## Struktur Project

```
pages/
  index.js          -> halaman utama (upload, tabel, kalender)
  _app.js
lib/
  dateCalc.js        -> rumus kalkulasi timeline
  excelParser.js      -> baca/tulis file Excel (pakai SheetJS/xlsx)
  calendarEvents.js   -> convert hasil kalkulasi -> event FullCalendar
  icsExport.js        -> convert hasil kalkulasi -> file .ics
components/
  VisaCalendar.js     -> wrapper FullCalendar (client-only)
  ResultTable.js       -> tabel hasil
  ConfigPanel.js        -> panel input buffer
```

## Tech Stack

- **Next.js 14** (Pages Router)
- **FullCalendar** (`@fullcalendar/react` + `daygrid` + `list` plugin) — library kalender
  JS paling populer & sudah dipakai jutaan produk production
- **SheetJS (`xlsx`)** — parsing file Excel di sisi browser
- **`ics`** — generate file `.ics` standar RFC 5545
- **`date-fns`** — utilitas kalkulasi tanggal

## Pengembangan Lanjutan (Ide)

- Ganti perhitungan hari kalender -> hari kerja (skip weekend/libur nasional).
- Simpan hasil ke database supaya reminder bisa dikirim otomatis via email/WhatsApp (n8n, cron job, dsb).
- Multi-sheet Excel untuk banyak kloter keberangkatan sekaligus.
- Role-based view: staff analyst vs staff follow-up dokumen.
