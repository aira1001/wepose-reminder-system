CREATE TABLE IF NOT EXISTS "parse_excel" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parse_excel_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"nama" text,
	"no_paspor" text,
	"pic" text,
	"tanggal_keberangkatan" date,
	"jenis_visa" text,
	"negara" text,
	"appointment" date,
	"waktu_proses_kedutaan" integer,
	"waktu_proses_wepose" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" text,
	"title" text,
	"start_date" date,
	"all_day" boolean DEFAULT true NOT NULL,
	"background_color" text,
	"border_color" text,
	"nama" text,
	"no_paspor" text,
	"jenis_visa" text,
	"stage" text,
	"warnings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_parse_excel_no_paspor" ON "parse_excel" USING btree ("no_paspor");--> statement-breakpoint
CREATE INDEX "idx_event_no_paspor" ON "event" USING btree ("no_paspor");--> statement-breakpoint
CREATE INDEX "idx_event_start_date" ON "event" USING btree ("start_date");