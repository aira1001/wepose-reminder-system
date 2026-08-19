import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { country } from "./country";

export const parseExcel = pgTable(
  "parse_excel",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    nama: text("nama"),
    no_paspor: text("no_paspor"),
    pic: text("pic"),
    tanggal_keberangkatan: date("tanggal_keberangkatan", { mode: "string" }),
    jenis_visa: text("jenis_visa"),
    country_id: bigint({ mode: "number" }).references(() => country.id),
    appointment: date("appointment", { mode: "string" }),
    waktu_proses_kedutaan: integer("waktu_proses_kedutaan"),
    waktu_proses_wepose: integer("waktu_proses_wepose"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [index("idx_parse_excel_no_paspor").on(table.no_paspor)],
);
