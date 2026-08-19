import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { parseExcel } from "./parse_excel";

export const event = pgTable(
  "event",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    event_id: text("event_id"),
    parse_excel_id: bigint({ mode: "number" }).references(() => parseExcel.id),
    title: text("title"),
    start_date: date("start_date", { mode: "string" }),
    all_day: boolean("all_day").notNull().default(true),
    background_color: text("background_color"),
    border_color: text("border_color"),
    nama: text("nama"),
    no_paspor: text("no_paspor"),
    jenis_visa: text("jenis_visa"),
    stage: text("stage"),
    warnings: jsonb("warnings"),
    created_at: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    deleted_at: timestamp("deleted_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_event_no_paspor").on(table.no_paspor),
    index("idx_event_start_date").on(table.start_date),
  ],
);
