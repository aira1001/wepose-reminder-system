import {
  bigint,
  date,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const country = pgTable(
  "country",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text("name"),
    holiday_date: date("holiday_date", { mode: "string" }),
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
  },
  (table) => [index("idx_country_name").on(table.name)],
);
