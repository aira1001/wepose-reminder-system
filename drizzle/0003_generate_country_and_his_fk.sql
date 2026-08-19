CREATE TABLE "country" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "country_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text,
	"holiday_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_country_name" ON "country" USING btree ("name");
--> statement-breakpoint
-- Ganti kolom string "negara" menjadi FK bigint "country_id" (nullable).
ALTER TABLE "parse_excel" DROP COLUMN "negara";
--> statement-breakpoint
ALTER TABLE "parse_excel" ADD COLUMN "country_id" bigint;
--> statement-breakpoint
ALTER TABLE "parse_excel" ADD CONSTRAINT "parse_excel_country_id_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country"("id") ON DELETE no action ON UPDATE no action;